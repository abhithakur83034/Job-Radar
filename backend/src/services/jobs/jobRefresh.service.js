import crypto from 'crypto';
import { env } from '../../config/env.js';
import { Profile } from '../../models/Profile.js';
import { JobSourceStatus } from '../../models/JobSourceStatus.js';
import { acquireLock, releaseLock } from '../../models/SchedulerLock.js';
import { PROVIDERS } from '../jobProviders/providerRegistry.js';
import { normalizeListing } from './jobNormalize.service.js';
import { upsertListings, scoreListingsForUser, rescoreAllForUser } from '../../utils/ingest.js';
import { SCORING_VERSION } from '../../utils/scoring.js';
import { AppSetting } from '../../models/AppSetting.js';
import { employerBoardsSource, refreshEmployerBoards } from './employerBoards.service.js';
import { expireClosedJobs } from './jobExpiry.service.js';
import { notifyNewMatches } from '../notifications.service.js';
import { JobRefreshRun } from '../../models/JobRefreshRun.js';
import { getSettings } from '../../config/runtimeSettings.js';

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

async function recordSuccess(id, startedAt, fetched, rejected) {
  await JobSourceStatus.updateOne(
    { _id: id },
    {
      $set: {
        lastAttemptAt: new Date(startedAt),
        lastSuccessAt: new Date(),
        lastStatus: 'success',
        lastDurationMs: Date.now() - startedAt,
        lastFetched: fetched,
        lastRejected: rejected,
        lastError: null,
        consecutiveFailures: 0,
      },
    },
    { upsert: true }
  );
}

async function recordFailure(id, startedAt, error) {
  await JobSourceStatus.updateOne(
    { _id: id },
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
    await recordSuccess(provider.id, startedAt, listings.length, rejected);
    return { id: provider.id, status: 'success', fetched: listings.length, rejected, listings };
  } catch (err) {
    const error = summarizeError(err);
    await recordFailure(provider.id, startedAt, error);
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
export async function runJobRefresh({
  trigger = 'scheduler',
  providers = PROVIDERS,
  includeBoards = true, // users' Greenhouse/Lever/Ashby companies
  includeExpiry = true, // hide jobs that have closed
  includeRescore = true, // apply a new SCORING_VERSION to every user once
  includeNotifications = true, // alert users about strong matches for newly found jobs
  triggeredBy = null, // admin user id for manual runs
} = {}) {
  const owner = `${trigger}:${crypto.randomUUID()}`;
  if (!(await acquireLock(LOCK_NAME, owner, LOCK_TTL_MS))) {
    return { status: 'locked', message: 'A refresh is already running' };
  }

  const startedAt = Date.now();
  // History record for the admin portal (created only once this run holds the lock)
  const run = await JobRefreshRun.create({ trigger, triggeredBy, startedAt: new Date(startedAt) });
  try {
    const now = Date.now();
    const configured = providers.filter((p) => p.isConfigured());
    const dueFlags = await Promise.all(configured.map((p) => isDue(p, now)));
    const due = configured.filter((_, i) => dueFlags[i]);
    const queries = due.some((p) => p.usesQueries) ? await buildQueries() : [];

    const results = await mapWithConcurrency(due, getSettings().fetchConcurrency, (p) => runProvider(p, queries));
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

    // Users' employer boards: new openings + closed-job detection (own interval and status)
    let boards = null;
    if (includeBoards && (await isDue(employerBoardsSource, now))) {
      const boardsStarted = Date.now();
      try {
        const r = await refreshEmployerBoards();
        await recordSuccess(employerBoardsSource.id, boardsStarted, r.fetched, 0);
        boards = { id: employerBoardsSource.id, status: 'success', ...r };
        newListings += r.newListings;
        newMatches += r.newMatches;
      } catch (err) {
        const error = summarizeError(err);
        await recordFailure(employerBoardsSource.id, boardsStarted, error);
        boards = { id: employerBoardsSource.id, status: 'failed', error };
      }
    } else if (includeBoards) {
      boards = { id: employerBoardsSource.id, status: 'not_due' };
    }

    const expiry = includeExpiry ? await expireClosedJobs() : null;
    const rescored = includeRescore ? await applyScoringVersion() : null;
    const notifications = includeNotifications ? await notifyNewMatches(new Date(startedAt)) : null;

    const providerSummaries = [
      ...(boards ? [boards] : []),
      ...results.map(({ listings: _l, ...summary }) => summary),
      ...configured.filter((p) => !due.includes(p)).map((p) => ({ id: p.id, status: 'not_due' })),
      ...providers.filter((p) => !p.isConfigured()).map((p) => ({ id: p.id, status: 'not_configured' })),
    ];
    const attempted = providerSummaries.filter((p) => p.status === 'success' || p.status === 'failed');
    const failed = attempted.filter((p) => p.status === 'failed');
    const outcome = failed.length === 0 ? 'completed' : failed.length === attempted.length ? 'failed' : 'partial';
    const closedJobs = (expiry?.jobicyClosed ?? 0) + (expiry?.agedOut ?? 0) + (boards?.closed ?? 0);

    await JobRefreshRun.updateOne(
      { _id: run._id },
      {
        status: outcome,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
        providers: providerSummaries.map(({ id, status, fetched, error }) => ({ id, status, fetched, error })),
        newListings,
        newMatches,
        closedJobs,
      }
    );

    return {
      status: 'completed',
      outcome,
      runId: String(run._id),
      trigger,
      durationMs: Date.now() - startedAt,
      expiry,
      rescored,
      notifications,
      providers: providerSummaries,
      newListings,
      newMatches,
      usersScored,
    };
  } catch (err) {
    await JobRefreshRun.updateOne(
      { _id: run._id },
      { status: 'failed', finishedAt: new Date(), durationMs: Date.now() - startedAt, error: summarizeError(err) }
    ).catch(() => {});
    throw err;
  } finally {
    await releaseLock(LOCK_NAME, owner);
  }
}

/** After a scoring-rules change, re-score every user's matches once against all open jobs. */
async function applyScoringVersion() {
  const applied = await AppSetting.findById('scoringVersion').lean();
  if (applied?.value === SCORING_VERSION) return null;

  const userIds = await Profile.distinct('userId');
  let newMatches = 0;
  for (const userId of userIds) newMatches += await rescoreAllForUser(userId);
  await AppSetting.updateOne({ _id: 'scoringVersion' }, { value: SCORING_VERSION }, { upsert: true });
  return { version: SCORING_VERSION, users: userIds.length, newMatches };
}

/** Safe, client-facing status for every background source (no secrets). */
export async function getSourceStatuses(providers = [employerBoardsSource, ...PROVIDERS]) {
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
