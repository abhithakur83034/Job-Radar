import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Profile } from '../src/models/Profile.js';
import { Job } from '../src/models/Job.js';
import { Match } from '../src/models/Match.js';
import { JobSourceStatus } from '../src/models/JobSourceStatus.js';
import { SchedulerLock, acquireLock, releaseLock } from '../src/models/SchedulerLock.js';
import { runJobRefresh, buildQueries } from '../src/services/jobs/jobRefresh.service.js';
import { deactivateMissingBoardJobs } from '../src/utils/ingest.js';
import { FetchError } from '../src/utils/safeFetch.js';
import { identityFor } from './helpers.js';

const request = supertest(app);
const EMAIL_RE = /@refresh-test\.com$/;
const SOURCES = ['test-ok', 'test-broken', 'test-later', 'test-keyed', 'test-query'];

function fakeProvider(overrides) {
  return {
    displayName: overrides.id,
    homepage: 'https://example.com',
    requiresKey: false,
    minIntervalMinutes: 0,
    usesQueries: false,
    isConfigured: () => true,
    ...overrides,
  };
}

const okJobs = [
  { externalId: 'a1', title: 'Senior React Engineer', company: 'Acme', location: 'Remote', description: 'React TypeScript', url: 'https://example.com/a1' },
  { externalId: 'a2', title: 'Backend Engineer', company: 'Acme', location: 'Remote', description: 'Go Postgres', url: 'https://example.com/a2' },
  { externalId: 'bad', title: '', url: 'javascript:alert(1)' }, // malformed: dropped, counted as rejected
];
const okProvider = fakeProvider({ id: 'test-ok', fetchJobs: async () => okJobs });
const brokenProvider = fakeProvider({
  id: 'test-broken',
  fetchJobs: async () => { throw new FetchError('HTTP_503', 'Source returned HTTP 503'); },
});

let userCookie;
let userId;

describe('Background job refresh', () => {
  beforeAll(async () => {
    const testDbUri = env.MONGODB_URI.replace(/\/[^/]+$/, '/job_radar_test');
    if (mongoose.connection.readyState === 0) await mongoose.connect(testDbUri);
    await cleanup();

    const res = await request.post('/api/v1/auth/register').send({
      name: 'Refresh Tester', email: 'user@refresh-test.com', ...identityFor('user@refresh-test.com'), password: 'password123',
    });
    userCookie = res.headers['set-cookie'];
    userId = res.body.user.id;
    await Profile.create({
      userId, name: 'FE', titles: ['Frontend Engineer'], keywords: ['React', 'TypeScript'], locations: ['Remote'], fitThreshold: 60,
    });
  });

  beforeEach(async () => {
    await JobSourceStatus.deleteMany({ _id: { $in: SOURCES } });
    await SchedulerLock.deleteMany({});
  });

  afterAll(async () => {
    await cleanup();
    await mongoose.connection.close();
  });

  async function cleanup() {
    const users = await User.find({ email: EMAIL_RE });
    const ids = users.map((u) => u._id);
    await Promise.all([
      Match.deleteMany({ userId: { $in: ids } }),
      Profile.deleteMany({ userId: { $in: ids } }),
      Job.deleteMany({ source: { $in: [...SOURCES, 'greenhouse-test'] } }),
      JobSourceStatus.deleteMany({ _id: { $in: SOURCES } }),
      User.deleteMany({ email: EMAIL_RE }),
    ]);
  }

  it('isolates a failing provider: others still update the jobs and feed', async () => {
    const result = await runJobRefresh({ trigger: 'test', providers: [brokenProvider, okProvider] });

    expect(result.status).toBe('completed');
    expect(result.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'test-broken', status: 'failed', error: 'HTTP_503: Source returned HTTP 503' }),
        expect.objectContaining({ id: 'test-ok', status: 'success', fetched: 2, rejected: 1 }),
      ])
    );
    expect(await Job.countDocuments({ source: 'test-ok' })).toBe(2);
    expect(await Match.countDocuments({ userId })).toBeGreaterThanOrEqual(1);

    const broken = await JobSourceStatus.findById('test-broken').lean();
    expect(broken).toMatchObject({ lastStatus: 'failed', consecutiveFailures: 1, lastSuccessAt: null });
  });

  it('does not create duplicates on repeated refreshes', async () => {
    await runJobRefresh({ trigger: 'test', providers: [okProvider] });
    const matchesBefore = await Match.countDocuments({ userId });
    await runJobRefresh({ trigger: 'test', providers: [okProvider] });

    expect(await Job.countDocuments({ source: 'test-ok' })).toBe(2);
    expect(await Match.countDocuments({ userId })).toBe(matchesBefore);
  });

  it('respects each provider’s minimum interval', async () => {
    const slow = fakeProvider({ id: 'test-later', minIntervalMinutes: 360, fetchJobs: async () => okJobs });
    const first = await runJobRefresh({ trigger: 'test', providers: [slow] });
    const second = await runJobRefresh({ trigger: 'admin', providers: [slow] });
    expect(first.providers[0].status).toBe('success');
    expect(second.providers[0]).toEqual({ id: 'test-later', status: 'not_due' });
  });

  it('skips unconfigured providers and query-based ones with no profiles to query', async () => {
    const keyed = fakeProvider({ id: 'test-keyed', requiresKey: true, isConfigured: () => false, fetchJobs: async () => okJobs });
    const result = await runJobRefresh({ trigger: 'test', providers: [keyed] });
    expect(result.providers).toEqual([{ id: 'test-keyed', status: 'not_configured' }]);
    expect(await buildQueries()).toEqual(expect.arrayContaining([{ keywords: 'frontend engineer', location: '' }]));
  });

  it('refuses to start while another run holds the lock', async () => {
    expect(await acquireLock('job-refresh', 'someone-else', 60000)).toBe(true);
    expect(await runJobRefresh({ trigger: 'test', providers: [okProvider] })).toMatchObject({ status: 'locked' });
    await releaseLock('job-refresh', 'someone-else');
    expect((await runJobRefresh({ trigger: 'test', providers: [okProvider] })).status).toBe('completed');
  });

  it('marks only stale jobs of a successfully refreshed board inactive and hides them from the feed', async () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const base = { source: 'greenhouse-test', location: 'Remote', description: 'React TypeScript', url: 'https://example.com/x' };
    const [stale, fresh, otherCompany] = await Job.create([
      { ...base, externalId: 'g1', title: 'Frontend Engineer', company: 'acme', lastSeenAt: old },
      { ...base, externalId: 'g2', title: 'Frontend Engineer II', company: 'acme', lastSeenAt: new Date() },
      { ...base, externalId: 'g3', title: 'Frontend Engineer III', company: 'globex', lastSeenAt: old },
    ]);
    const profile = await Profile.findOne({ userId });
    await Match.create({ userId, profileId: profile._id, jobId: stale._id, fitScore: 90 });

    expect(await deactivateMissingBoardJobs('greenhouse-test', 'acme', 3)).toBe(1);
    expect((await Job.findById(stale._id)).isActive).toBe(false);
    expect((await Job.findById(fresh._id)).isActive).toBe(true);
    expect((await Job.findById(otherCompany._id)).isActive).toBe(true);

    const feed = await request.get('/api/v1/matches').set('Cookie', userCookie);
    expect(feed.body.matches.some((m) => m.listing.id === String(stale._id))).toBe(false);
  });

  describe('job-source routes', () => {
    it('lists sources for signed-in users without error details or secrets', async () => {
      expect((await request.get('/api/v1/job-sources')).status).toBe(401);
      const res = await request.get('/api/v1/job-sources').set('Cookie', userCookie);
      expect(res.status).toBe(200);
      expect(res.body.sources.map((s) => s.id)).toEqual(
        expect.arrayContaining(['remotive', 'remoteok', 'jobicy', 'themuse', 'adzuna', 'jooble'])
      );
      for (const s of res.body.sources) expect(s).not.toHaveProperty('lastError');
      expect(JSON.stringify(res.body)).not.toMatch(/app_key|api_key|test-key/i);
    });

    it('restricts status and manual refresh to admins', async () => {
      expect((await request.get('/api/v1/admin/job-sources/status').set('Cookie', userCookie)).status).toBe(403);
      expect((await request.post('/api/v1/admin/job-sources/refresh').set('Cookie', userCookie)).status).toBe(403);

      await User.updateOne({ _id: userId }, { role: 'admin' });
      const status = await request.get('/api/v1/admin/job-sources/status').set('Cookie', userCookie);
      expect(status.status).toBe(200);
      expect(status.body.sources[0]).toHaveProperty('lastError');
      await User.updateOne({ _id: userId }, { role: 'user' });
    });
  });
});

describe('Match list payload', () => {
  it('omits job descriptions from the feed list and honours ?limit', async () => {
    const testDbUri = env.MONGODB_URI.replace(/\/[^/]+$/, '/job_radar_test');
    if (mongoose.connection.readyState === 0) await mongoose.connect(testDbUri);
    await User.deleteMany({ email: /@payload-test\.com$/ });
    const reg = await request.post('/api/v1/auth/register').send({
      name: 'Payload', email: 'p@payload-test.com', ...identityFor('p@payload-test.com'), password: 'password123',
    });
    const cookie = reg.headers['set-cookie'];
    const profile = await Profile.create({ userId: reg.body.user.id, name: 'P', titles: ['Engineer'] });
    const jobs = await Job.create(
      [1, 2, 3].map((i) => ({
        source: 'test-payload', externalId: `p${i}`, title: `Engineer ${i}`, company: 'Acme', location: 'Remote',
        description: 'x'.repeat(5000), url: `https://example.com/p${i}`,
      }))
    );
    await Match.create(jobs.map((j, i) => ({ userId: reg.body.user.id, profileId: profile._id, jobId: j._id, fitScore: 90 - i })));

    const all = await request.get('/api/v1/matches').set('Cookie', cookie);
    expect(all.body.matches).toHaveLength(3);
    expect(all.body.matches[0].listing).not.toHaveProperty('description');
    expect(JSON.stringify(all.body)).not.toContain('xxxxxxxxxx');

    const top = await request.get('/api/v1/matches?limit=1').set('Cookie', cookie);
    expect(top.body.matches).toHaveLength(1);
    expect(top.body.matches[0].listing.title).toBe('Engineer 1');

    const detail = await request.get(`/api/v1/matches/${top.body.matches[0].id}`).set('Cookie', cookie);
    expect(detail.body.match.listing.description).toHaveLength(5000);

    // "top" resolves to the best match with full details in a single call
    const best = await request.get('/api/v1/matches/top').set('Cookie', cookie);
    expect(best.body.match.id).toBe(top.body.matches[0].id);
    expect(best.body.match.listing.description).toHaveLength(5000);

    await Match.deleteMany({ userId: reg.body.user.id });
    await Profile.deleteMany({ userId: reg.body.user.id });
    await Job.deleteMany({ source: 'test-payload' });
    await User.deleteMany({ email: /@payload-test\.com$/ });
    await mongoose.connection.close();
  });
});
