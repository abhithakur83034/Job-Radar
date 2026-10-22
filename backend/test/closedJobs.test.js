import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Profile } from '../src/models/Profile.js';
import { Job } from '../src/models/Job.js';
import { Match } from '../src/models/Match.js';
import { JobSourceStatus } from '../src/models/JobSourceStatus.js';
import { AppSetting } from '../src/models/AppSetting.js';
import { SchedulerLock } from '../src/models/SchedulerLock.js';
import { runJobRefresh } from '../src/services/jobs/jobRefresh.service.js';
import { expireClosedJobs } from '../src/services/jobs/jobExpiry.service.js';
import { rescoreAllForUser } from '../src/utils/ingest.js';
import { SCORING_VERSION } from '../src/utils/scoring.js';
import { identityFor } from './helpers.js';

const request = supertest(app);
const EMAIL_RE = /@closed-test\.com$/;
const DAY = 24 * 60 * 60 * 1000;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let alice; // follows "acmeco" board
let bob; // follows "otherco" board
let aliceCookie;

async function register(name, email) {
  const res = await request.post('/api/v1/auth/register').send({ name, email, ...identityFor(email), password: 'password123' });
  return { id: res.body.user.id, cookie: res.headers['set-cookie'] };
}

async function cleanup() {
  const users = await User.find({ email: EMAIL_RE });
  const ids = users.map((u) => u._id);
  await Promise.all([
    Match.deleteMany({ userId: { $in: ids } }),
    Profile.deleteMany({ userId: { $in: ids } }),
    Job.deleteMany({ $or: [{ company: { $in: ['acmeco', 'otherco'] } }, { externalId: /^ct-/ }] }),
    User.deleteMany({ email: EMAIL_RE }),
  ]);
}

describe('Fresh openings and closed jobs', () => {
  beforeAll(async () => {
    const testDbUri = env.MONGODB_URI.replace(/\/[^/]+$/, '/job_radar_test');
    if (mongoose.connection.readyState === 0) await mongoose.connect(testDbUri);
    await cleanup();
    await SchedulerLock.deleteMany({});

    const a = await register('Alice', 'alice@closed-test.com');
    const b = await register('Bob', 'bob@closed-test.com');
    alice = a.id;
    aliceCookie = a.cookie;
    bob = b.id;
    await User.updateOne({ _id: alice }, { scanCompanies: ['acmeco'] });
    await User.updateOne({ _id: bob }, { scanCompanies: ['otherco'] });
    const profile = { titles: ['Backend Engineer'], keywords: ['Node.js', 'PostgreSQL'], locations: ['Remote'], fitThreshold: 65 };
    await Profile.create([{ userId: alice, name: 'A', ...profile }, { userId: bob, name: 'B', ...profile }]);
  });

  afterEach(() => vi.unstubAllGlobals());

  afterAll(async () => {
    await cleanup();
    await mongoose.connection.close();
  });

  it('refreshes users’ company boards in the background and scores each company only for its followers', async () => {
    await JobSourceStatus.deleteOne({ _id: 'boards' });
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('boards-api.greenhouse.io/v1/boards/acmeco/')) {
        return json({
          jobs: [{
            id: 9001, title: 'Senior Backend Engineer', location: { name: 'Remote' },
            content: '&lt;p&gt;Node.js and Postgres&lt;/p&gt;', absolute_url: 'https://boards.greenhouse.io/acmeco/jobs/9001',
          }],
        });
      }
      if (String(url).includes('greenhouse.io/v1/boards/otherco/')) return json({ jobs: [] });
      return json({}, 404); // Lever/Ashby fallbacks
    }));

    const result = await runJobRefresh({ trigger: 'test', providers: [], includeExpiry: false, includeRescore: false });
    const boards = result.providers.find((p) => p.id === 'boards');
    expect(boards).toMatchObject({ status: 'success', fetched: 1, newMatches: 1 });

    const job = await Job.findOne({ source: 'greenhouse', company: 'acmeco', externalId: '9001' });
    expect(job.isActive).toBe(true);
    expect(await Match.countDocuments({ userId: alice, jobId: job._id })).toBe(1);
    expect(await Match.countDocuments({ userId: bob, jobId: job._id })).toBe(0); // Bob didn't choose acmeco

    const again = await runJobRefresh({ trigger: 'test', providers: [], includeExpiry: false, includeRescore: false });
    expect(again.providers.find((p) => p.id === 'boards')).toEqual({ id: 'boards', status: 'not_due' });
  });

  it('closes board jobs the company stopped listing (after the grace period), but not after a failed fetch', async () => {
    await JobSourceStatus.deleteOne({ _id: 'boards' });
    await Job.create({
      source: 'greenhouse', company: 'acmeco', externalId: 'gone-1', title: 'Old Backend Engineer', location: 'Remote',
      description: 'x', url: 'https://boards.greenhouse.io/acmeco/jobs/1', lastSeenAt: new Date(Date.now() - 3 * DAY),
    });
    await Job.create({
      source: 'greenhouse', company: 'otherco', externalId: 'kept-1', title: 'Backend Engineer', location: 'Remote',
      description: 'x', url: 'https://boards.greenhouse.io/otherco/jobs/1', lastSeenAt: new Date(Date.now() - 3 * DAY),
    });
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('/boards/acmeco/')) return json({ jobs: [] }); // acmeco: success, empty
      if (String(url).includes('/boards/otherco/')) return json({}, 503); // otherco: failure
      return json({}, 404);
    }));

    await runJobRefresh({ trigger: 'test', providers: [], includeExpiry: false, includeRescore: false });
    expect((await Job.findOne({ externalId: 'gone-1' })).isActive).toBe(false);
    expect((await Job.findOne({ externalId: 'kept-1' })).isActive).toBe(true);
  });

  it('closes Jobicy jobs its status API reports as ended, and changes nothing if the check fails', async () => {
    await Job.create(['ct-1', 'ct-2'].map((id) => ({
      source: 'jobicy', externalId: id, title: 'Engineer', company: 'X', location: 'Remote', description: 'x',
      url: `https://jobicy.com/jobs/${id}`, lastSeenAt: new Date(),
    })));

    vi.stubGlobal('fetch', vi.fn(async () => json({}, 500)));
    const failed = await expireClosedJobs();
    expect(failed.errors.join()).toMatch(/jobicy-status/);
    expect(await Job.countDocuments({ externalId: /^ct-/, isActive: false })).toBe(0);

    vi.stubGlobal('fetch', vi.fn(async () => json({ jobs: [{ id: 'ct-1', status: 'active' }, { id: 'ct-2', status: 'unknown' }] })));
    const ok = await expireClosedJobs();
    expect(ok.jobicyClosed).toBeGreaterThanOrEqual(1);
    expect((await Job.findOne({ externalId: 'ct-1' })).isActive).toBe(true);
    expect((await Job.findOne({ externalId: 'ct-2' })).isActive).toBe(false);
  });

  it('retires old listings from feeds that can’t report closures, leaving fresh ones and board jobs', async () => {
    const old = new Date(Date.now() - (env.JOB_LISTING_MAX_AGE_DAYS + 5) * DAY);
    const base = { title: 'Engineer', company: 'X', location: 'Remote', description: 'x', url: 'https://example.com/j' };
    await Job.create([
      { ...base, source: 'remoteok', externalId: 'ct-old', postedAt: old },
      { ...base, source: 'remoteok', externalId: 'ct-new', postedAt: new Date() },
      { ...base, source: 'linkedin', externalId: 'ct-alert-old', postedAt: null, foundAt: old },
      { ...base, source: 'greenhouse', company: 'otherco', externalId: 'ct-board-old', postedAt: old, lastSeenAt: new Date() },
    ]);
    vi.stubGlobal('fetch', vi.fn(async () => json({ jobs: [] })));
    await expireClosedJobs();

    const active = async (id) => (await Job.findOne({ externalId: id })).isActive;
    expect(await active('ct-old')).toBe(false);
    expect(await active('ct-alert-old')).toBe(false);
    expect(await active('ct-new')).toBe(true);
    expect(await active('ct-board-old')).toBe(true); // boards close via their own refresh, not age
  });

  it('hides matches below the profile threshold from the feed unless saved', async () => {
    const profile = await Profile.findOne({ userId: alice });
    const mk = (externalId) => Job.create({
      source: 'greenhouse', company: 'acmeco', externalId, title: 'Backend Engineer', location: 'Remote',
      description: 'x', url: `https://example.com/${externalId}`, lastSeenAt: new Date(),
    });
    const [low, lowSaved] = [await mk('ct-low'), await mk('ct-low-saved')];
    await Match.create([
      { userId: alice, profileId: profile._id, jobId: low._id, fitScore: 40 },
      { userId: alice, profileId: profile._id, jobId: lowSaved._id, fitScore: 40, saved: true },
    ]);
    const feed = await request.get('/api/v1/matches').set('Cookie', aliceCookie);
    const ids = feed.body.matches.map((m) => m.listing.id);
    expect(ids).not.toContain(String(low._id));
    expect(ids).toContain(String(lowSaved._id));
  });

  it('re-scores a user against all open jobs, and applies a new scoring version only once', async () => {
    await Job.create({
      source: 'greenhouse', company: 'otherco', externalId: 'ct-rescore', title: 'Senior Backend Engineer',
      location: 'Remote', description: 'Node.js, PostgreSQL', url: 'https://example.com/rescore', lastSeenAt: new Date(),
    });
    const before = await Match.countDocuments({ userId: bob });
    expect(await rescoreAllForUser(bob)).toBeGreaterThanOrEqual(1);
    expect(await Match.countDocuments({ userId: bob })).toBeGreaterThan(before);

    await AppSetting.deleteOne({ _id: 'scoringVersion' });
    const first = await runJobRefresh({ trigger: 'test', providers: [], includeBoards: false, includeExpiry: false });
    expect(first.rescored).toMatchObject({ version: SCORING_VERSION });
    const second = await runJobRefresh({ trigger: 'test', providers: [], includeBoards: false, includeExpiry: false });
    expect(second.rescored).toBeNull();
  });
});

describe('Company lists come from data, not code', () => {
  it('starts new users with no companies unless DEFAULT_SCAN_COMPANIES is set, and suggests from live data', async () => {
    const testDbUri = env.MONGODB_URI.replace(/\/[^/]+$/, '/job_radar_test');
    if (mongoose.connection.readyState === 0) await mongoose.connect(testDbUri);
    await User.deleteMany({ email: /@companies-test\.com$/ });
    await Job.deleteMany({ company: 'suggestco' });
    const saved = env.DEFAULT_SCAN_COMPANIES;

    const res = await request.post('/api/v1/auth/register').send({
      name: 'C', email: 'c@companies-test.com', ...identityFor('c@companies-test.com'), password: 'password123',
    });
    const cookie = res.headers['set-cookie'];
    await Job.create({
      source: 'greenhouse', company: 'suggestco', externalId: 'sg-1', title: 'Engineer', location: 'Remote',
      description: 'x', url: 'https://example.com/sg', lastSeenAt: new Date(),
    });

    env.DEFAULT_SCAN_COMPANIES = undefined;
    const empty = await request.get('/api/v1/jobs/companies').set('Cookie', cookie);
    expect(empty.body.companies).toEqual([]);
    expect(empty.body.suggestions.map((s) => s.slug)).toContain('suggestco');

    const scan = await request.post('/api/v1/jobs/sync').set('Cookie', cookie).send({});
    expect(scan.status).toBe(400);
    expect(scan.body.error).toMatch(/add at least one company/i);

    env.DEFAULT_SCAN_COMPANIES = 'SuggestCo, other-co, bad slug!';
    const configured = await request.get('/api/v1/jobs/companies').set('Cookie', cookie);
    expect(configured.body.companies).toEqual(['suggestco', 'other-co']);
    expect(configured.body.suggestions.map((s) => s.slug)).not.toContain('suggestco'); // already chosen

    env.DEFAULT_SCAN_COMPANIES = saved;
    await Job.deleteMany({ company: 'suggestco' });
    await User.deleteMany({ email: /@companies-test\.com$/ });
    await mongoose.connection.close();
  });
});
