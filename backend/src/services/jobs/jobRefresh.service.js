import crypto from 'crypto';
import { env } from '../../config/env.js';
import { Profile } from '../../models/Profile.js';
import { JobSourceStatus } from '../../models/JobSourceStatus.js';
import { acquireLock, releaseLock } from '../../models/SchedulerLock.js';
import { PROVIDERS } from '../jobProviders/providerRegistry.js';
import { normalizeListing } from './jobNormalize.service.js';
import { upsertListings, scoreListingsForUser } from '../../utils/ingest.js';

const LOCK_NAME = 'job-refresh';
const LOCK_TTL_MS = 30 * 60 * 1000;
const MAX_QUERIES = 5;

/** Short, safe error summary for status records (no stack traces, URLs with keys, or payloads). */
export function summarizeError(err) {
  const code = err?.code && /^[A-Z_0-9]+$/.test(err.code) ? err.code : 'ERROR';
  const message = err?.name === 'FetchError' ? err.message : 'Unexpected error';
  return `${code}: ${String(message).slice(0, 200)}`;
}

/** Search queries for keyword-based sources: the most common target titles across all profiles. */
export async function buildQueries() {
  const [titles, locations] = await Promise.all([
    Profile.aggregate([
      { $unwind: '$titles' },
      { $group: { _id: { $toLower: { $trim: { input: '$titles' } } }, count: { $sum: 1 } } },
      { $match: { _id: { $ne: '' } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: MAX_QUERIES },
    ]),
    Profile.aggregate([
      { $unwind: '$locations' },
      { $group: { _id: { $trim: { input: '$locations' } }, count: { $sum: 1 } } },
      { $match: { _id: { $not: /^(remote|anywhere|worldwide)?$/i } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]),
  ]);
  const location = locations[0]?._id ?? '';
  return titles.map((t) => ({ keywords: t._id, location }));
}

async function isDue(provider, now) {
  const status = await JobSourceStatus.findById(provider.id).lean();
  if (!status?.lastAttemptAt) return true;
  // Back off further after repeated failures (x2 per failure, capped at 24h)
  const backoff = Math.min(2 ** Math.min(status.consecutiveFailures, 5), 24 * 60 / provider.minIntervalMinutes);
  return now - status.lastAttemptAt.getTime() >= provider.minIntervalMinutes * 60 * 1000 * Math.max(1, backoff);
}

async function runProvider(provider, queries) {
  const startedAt = Date.now();
  try {
    if (provider.usesQueries && queries.length === 0) {
      return { id: provider.id, status: 'skipped', reason: 'No search profiles to query yet', listings: [] };
    }
    const raw = await provider.fetchJobs({ queries });
    const listings = [];
    let rejected = 0;
    for (const item of Array.isArray(raw) ? raw : []) {
      const listing = normalizeListing(item, provider.id);
      if (listing) listings.push(listing);
      else rejected++;
    }
    await JobSourceStatus.updateOne(
      { _id: provider.id },
      {
        $set: {
          lastAttemptAt: new Date(startedAt),
          lastSuccessAt: new Date(),
          lastStatus: 'success',
          lastDurationMs: Date.now() - startedAt,
          lastFetched: listings.length,
          lastRejected: rejected,
          lastError: null,
          consecutiveFailures: 0,
        },
      },
      { upsert: true }
    );
    return { id: provider.id, status: 'success', fetched: listings.length, rejected, listings };
  } catch (err) {
    const error = summarizeError(err);
    await JobSourceStatus.updateOne(
      { _id: provider.id },
      {
        $set: {
          lastAttemptAt: new Date(startedAt),
          lastStatus: 'failed',
          lastDurationMs: Date.now() - startedAt,
          lastError: error,
        },
        $inc: { consecutiveFailures: 1 },
      },
      { upsert: true }
    );
    return { id: provider.id, status: 'failed', error, listings: [] };
  }
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    })
  );
  return results;
}

/**
 * Refresh all configured, due providers. Each provider fails independently; one
 * run at a time across instances (Mongo lease lock). Provider rate limits
 * (minIntervalMinutes) are always respected, including for manual runs.
 */
export async function runJobRefresh({ trigger = 'scheduler', providers = PROVIDERS } = {}) {
  const owner = `${trigger}:${crypto.randomUUID()}`;
  if (!(await acquireLock(LOCK_NAME, owner, LOCK_TTL_MS))) {
    return { status: 'locked', message: 'A refresh is already running' };
  }

  const startedAt = Date.now();
  try {
    const now = Date.now();
    const configured = providers.filter((p) => p.isConfigured());
    const dueFlags = await Promise.all(configured.map((p) => isDue(p, now)));
    const due = configured.filter((_, i) => dueFlags[i]);
    const queries = due.some((p) => p.usesQueries) ? await buildQueries() : [];

    const results = await mapWithConcurrency(due, env.JOB_FETCH_CONCURRENCY, (p) => runProvider(p, queries));
    const listings = results.flatMap((r) => r.listings);

    let newListings = 0;
    let newMatches = 0;
    let usersScored = 0;
    if (listings.length > 0) {
      const upserted = await upsertListings(listings);
      newListings = upserted.newListings;
      const userIds = await Profile.distinct('userId');
      for (const userId of userIds) {
        newMatches += await scoreListingsForUser(userId, listings, upserted.jobIdByKey);
        usersScored++;
      }
    }

    return {
      status: 'completed',
      trigger,
      durationMs: Date.now() - startedAt,
      providers: [
        ...results.map(({ listings: _l, ...summary }) => summary),
        ...configured.filter((p) => !due.includes(p)).map((p) => ({ id: p.id, status: 'not_due' })),
        ...providers.filter((p) => !p.isConfigured()).map((p) => ({ id: p.id, status: 'not_configured' })),
      ],
      newListings,
      newMatches,
      usersScored,
    };
  } finally {
    await releaseLock(LOCK_NAME, owner);
  }
}

/** Safe, client-facing status for every background source (no secrets). */
export async function getSourceStatuses(providers = PROVIDERS) {
  const statuses = await JobSourceStatus.find({ _id: { $in: providers.map((p) => p.id) } }).lean();
  const byId = new Map(statuses.map((s) => [s._id, s]));
  return providers.map((p) => {
    const s = byId.get(p.id);
    return {
      id: p.id,
      displayName: p.displayName,
      homepage: p.homepage,
      requiresKey: p.requiresKey,
      configured: p.isConfigured(),
      refreshEveryMinutes: p.minIntervalMinutes,
      lastAttemptAt: s?.lastAttemptAt ?? null,
      lastSuccessAt: s?.lastSuccessAt ?? null,
      lastStatus: s?.lastStatus ?? null,
      lastFetched: s?.lastFetched ?? 0,
      lastError: s?.lastError ?? null,
    };
  });
}
