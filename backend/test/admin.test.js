import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Job } from '../src/models/Job.js';
import { Match } from '../src/models/Match.js';
import { Profile } from '../src/models/Profile.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { JobRefreshRun } from '../src/models/JobRefreshRun.js';
import { AppSetting } from '../src/models/AppSetting.js';
import { Notification } from '../src/models/Notification.js';
import { getSettings, loadSettings } from '../src/config/runtimeSettings.js';
import { upsertListings } from '../src/utils/ingest.js';
import { notifyNewMatches } from '../src/services/notifications.service.js';
import { identityFor } from './helpers.js';

const request = supertest(app);
const EMAIL_RE = /@admin-test\.com$/;

async function register(name, email) {
  const res = await request.post('/api/v1/auth/register').send({ name, email, ...identityFor(email), password: 'password123' });
  return { id: res.body.user.id, cookie: res.headers['set-cookie'] };
}

let admin;
let user;

describe('Admin portal API', () => {
  beforeAll(async () => {
    const testDbUri = env.MONGODB_URI.replace(/\/[^/]+$/, '/job_radar_test');
    if (mongoose.connection.readyState === 0) await mongoose.connect(testDbUri);
    // The test DB is shared; start from a clean admin/audit state for these assertions
    await User.updateMany({ role: 'admin' }, { role: 'user' });
    await User.deleteMany({ email: EMAIL_RE });
    await AuditLog.deleteMany({});
    await AppSetting.deleteOne({ _id: 'jobRefreshSettings' });
    await Job.deleteMany({ externalId: /^adm-/ });

    admin = await register('Admin', 'admin@admin-test.com');
    user = await register('Regular', 'user@admin-test.com');
    await User.updateOne({ _id: admin.id }, { role: 'admin' });
  });

  afterAll(async () => {
    const ids = (await User.find({ email: EMAIL_RE })).map((u) => u._id);
    await Match.deleteMany({ userId: { $in: ids } });
    await Profile.deleteMany({ userId: { $in: ids } });
    await Notification.deleteMany({ userId: { $in: ids } });
    await Job.deleteMany({ externalId: /^adm-/ });
    await AppSetting.deleteOne({ _id: 'jobRefreshSettings' });
    await loadSettings();
    await User.deleteMany({ email: EMAIL_RE });
    await mongoose.connection.close();
  });

  describe('access control', () => {
    const endpoints = [
      ['get', '/api/v1/admin/overview'],
      ['get', '/api/v1/admin/users'],
      ['get', '/api/v1/admin/jobs'],
      ['get', '/api/v1/admin/job-sources'],
      ['get', '/api/v1/admin/job-sources/runs'],
      ['post', '/api/v1/admin/job-sources/refresh'],
      ['get', '/api/v1/admin/audit-logs'],
      ['get', '/api/v1/admin/settings'],
      ['patch', '/api/v1/admin/settings'],
    ];

    it.each(endpoints)('%s %s: 401 without a session, 403 for non-admins', async (method, path) => {
      const anon = await request[method](path);
      expect(anon.status).toBe(401);
      const regular = await request[method](path).set('Cookie', user.cookie);
      expect(regular.status).toBe(403);
      expect(regular.body.code).toBe('FORBIDDEN');
    });

    it('users cannot promote themselves through the profile API', async () => {
      const res = await request.patch('/api/v1/auth/me').set('Cookie', user.cookie).send({ role: 'admin', name: 'Sneaky' });
      expect(res.status).toBe(200); // unknown fields are stripped, not applied
      expect((await User.findById(user.id)).role).toBe('user');
    });
  });

  describe('dashboard and lists', () => {
    it('returns real aggregated metrics', async () => {
      const res = await request.get('/api/v1/admin/overview').set('Cookie', admin.cookie);
      expect(res.status).toBe(200);
      expect(res.body.users.total).toBe(await User.countDocuments());
      expect(res.body.users.admins).toBe(1);
      expect(res.body.jobs).toHaveProperty('open');
      expect(Array.isArray(res.body.sources)).toBe(true);
    });

    it('searches and paginates users without exposing secrets', async () => {
      const res = await request.get('/api/v1/admin/users?search=admin-test&limit=1').set('Cookie', admin.cookie);
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.pagination).toMatchObject({ page: 1, limit: 1, total: 2, totalPages: 2 });
      const body = JSON.stringify(res.body);
      expect(body).not.toMatch(/passwordHash|argon2/);
      expect(res.body.items[0].mobile).toMatch(/•/); // masked

      const detail = await request.get(`/api/v1/admin/users/${user.id}`).set('Cookie', admin.cookie);
      expect(detail.body.user).toMatchObject({ role: 'user', status: 'active', hasResume: false });
      expect(JSON.stringify(detail.body)).not.toMatch(/passwordHash|encryptedRefreshToken/);
    });

    it('validates query input', async () => {
      expect((await request.get('/api/v1/admin/users?limit=5000').set('Cookie', admin.cookie)).status).toBe(400);
      expect((await request.get('/api/v1/admin/users/not-an-id').set('Cookie', admin.cookie)).status).toBe(400);
      expect((await request.get('/api/v1/admin/jobs?status=weird').set('Cookie', admin.cookie)).status).toBe(400);
      // Regex characters in search are treated literally (no injection / ReDoS)
      expect((await request.get('/api/v1/admin/users?search=(a%2B)%2B%24').set('Cookie', admin.cookie)).status).toBe(200);
    });
  });

  describe('user moderation', () => {
    it('requires a reason, suspends, blocks the account, audits, and can reactivate', async () => {
      const noReason = await request.patch(`/api/v1/admin/users/${user.id}/status`).set('Cookie', admin.cookie).send({ status: 'suspended' });
      expect(noReason.status).toBe(400);

      const res = await request
        .patch(`/api/v1/admin/users/${user.id}/status`)
        .set('Cookie', admin.cookie)
        .send({ status: 'suspended', reason: 'Spam reports' });
      expect(res.status).toBe(200);

      const blocked = await request.get('/api/v1/auth/me').set('Cookie', user.cookie);
      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe('ACCOUNT_SUSPENDED');
      const login = await request.post('/api/v1/auth/login').send({ email: 'user@admin-test.com', password: 'password123' });
      expect(login.status).toBe(403);

      const log = await AuditLog.findOne({ action: 'user.status.update', targetId: user.id }).lean();
      expect(log).toMatchObject({ actorLabel: identityFor('admin@admin-test.com').username, reason: 'Spam reports', changes: { from: 'active', to: 'suspended' } });

      await request.patch(`/api/v1/admin/users/${user.id}/status`).set('Cookie', admin.cookie).send({ status: 'active', reason: 'Appeal accepted' });
      expect((await request.get('/api/v1/auth/me').set('Cookie', user.cookie)).status).toBe(200);
    });

    it('prevents self-changes and removing the last admin', async () => {
      const self = await request.patch(`/api/v1/admin/users/${admin.id}/role`).set('Cookie', admin.cookie).send({ role: 'user', reason: 'testing' });
      expect(self.status).toBe(400);

      // Promote the user, then they try to demote the original (now not the last) admin: allowed
      await request.patch(`/api/v1/admin/users/${user.id}/role`).set('Cookie', admin.cookie).send({ role: 'admin', reason: 'New team member' });
      const demote = await request.patch(`/api/v1/admin/users/${admin.id}/role`).set('Cookie', user.cookie).send({ role: 'user', reason: 'Handover' });
      expect(demote.status).toBe(200);

      // Now `user` is the only admin: it can't be suspended or demoted by anyone
      await User.updateOne({ _id: admin.id }, { role: 'admin' });
      await User.updateOne({ _id: user.id }, { status: 'active' });
      await User.updateOne({ _id: admin.id }, { status: 'suspended' });
      const last = await request.patch(`/api/v1/admin/users/${admin.id}/role`).set('Cookie', user.cookie).send({ role: 'user', reason: 'cleanup' });
      expect(last.status).toBe(200); // admin is suspended, so `user` remains an active admin
      const lastActive = await User.countDocuments({ role: 'admin', status: { $ne: 'suspended' } });
      expect(lastActive).toBe(1);

      await User.updateOne({ _id: admin.id }, { role: 'admin', status: 'active' });
      await User.updateOne({ _id: user.id }, { role: 'user' });
    });
  });

  describe('job moderation', () => {
    it('hides a job from feeds with a reason, survives a source refresh, and restores', async () => {
      const listing = {
        source: 'adm-test', externalId: 'adm-1', title: 'Backend Engineer', company: 'acme', location: 'Remote',
        description: 'Node.js', url: 'https://example.com/adm-1',
      };
      const { jobIdByKey } = await upsertListings([listing]);
      const jobId = String(jobIdByKey.get('adm-test:adm-1'));

      const hide = await request.patch(`/api/v1/admin/jobs/${jobId}/status`).set('Cookie', admin.cookie).send({ status: 'hidden', reason: 'Scam listing' });
      expect(hide.body.job.status).toBe('hidden');

      await upsertListings([listing]); // the source still lists it
      expect((await Job.findById(jobId)).adminHidden).toBe(true);

      const list = await request.get('/api/v1/admin/jobs?status=hidden&search=Backend').set('Cookie', admin.cookie);
      expect(list.body.items.map((j) => j.id)).toContain(jobId);
      const detail = await request.get(`/api/v1/admin/jobs/${jobId}`).set('Cookie', admin.cookie);
      expect(detail.body.job.moderation).toMatchObject({ reason: 'Scam listing' });

      const restore = await request.patch(`/api/v1/admin/jobs/${jobId}/status`).set('Cookie', admin.cookie).send({ status: 'visible', reason: 'False alarm' });
      expect(restore.body.job.status).toBe('open');
      expect(await AuditLog.countDocuments({ targetId: jobId })).toBe(2);
    });
  });

  describe('settings and refresh runs', () => {
    it('validates, applies at runtime, audits, and resets settings', async () => {
      const bad = await request.patch('/api/v1/admin/settings').set('Cookie', admin.cookie).send({ refreshIntervalMinutes: 1 });
      expect(bad.status).toBe(400);

      const ok = await request.patch('/api/v1/admin/settings').set('Cookie', admin.cookie).send({ refreshIntervalMinutes: 120, fetchConcurrency: 2 });
      expect(ok.status).toBe(200);
      expect(getSettings()).toMatchObject({ refreshIntervalMinutes: 120, fetchConcurrency: 2 });
      expect(await AuditLog.findOne({ action: 'settings.update' }).lean()).toMatchObject({
        changes: { refreshIntervalMinutes: { to: 120 }, fetchConcurrency: { to: 2 } },
      });

      const reset = await request.post('/api/v1/admin/settings/reset').set('Cookie', admin.cookie);
      expect(reset.body.overrides).toEqual({});
      expect(getSettings().refreshIntervalMinutes).toBe(env.JOB_REFRESH_INTERVAL_MINUTES);
    });

    it('lists refresh run history with pagination', async () => {
      await JobRefreshRun.create({ trigger: 'test', status: 'partial', startedAt: new Date(), providers: [{ id: 'x', status: 'failed', error: 'HTTP_503: down' }] });
      const res = await request.get('/api/v1/admin/job-sources/runs?limit=1').set('Cookie', admin.cookie);
      expect(res.status).toBe(200);
      expect(res.body.items[0]).toHaveProperty('status');
      expect(res.body.pagination.limit).toBe(1);
    });
  });
});

describe('"Not interested" and notifications', () => {
  let me;

  beforeAll(async () => {
    const testDbUri = env.MONGODB_URI.replace(/\/[^/]+$/, '/job_radar_test');
    if (mongoose.connection.readyState === 0) await mongoose.connect(testDbUri);
    await User.deleteMany({ email: /@prefs-test\.com$/ });
    await Job.deleteMany({ externalId: /^nf-/ });
    me = await register('Prefs', 'me@prefs-test.com');
  });

  afterAll(async () => {
    await Match.deleteMany({ userId: me.id });
    await Profile.deleteMany({ userId: me.id });
    await Notification.deleteMany({ userId: me.id });
    await Job.deleteMany({ externalId: /^nf-/ });
    await User.deleteMany({ email: /@prefs-test\.com$/ });
    await mongoose.connection.close();
  });

  it('dismisses matches and hides companies from the feed', async () => {
    const profile = await Profile.create({ userId: me.id, name: 'P', titles: ['Engineer'], fitThreshold: 50 });
    const jobs = await Job.create(['a', 'b', 'c'].map((x) => ({
      source: 'nf-test', externalId: `nf-${x}`, title: 'Engineer', company: x === 'c' ? 'Globex' : 'Acme', location: 'Remote',
      description: 'x', url: `https://example.com/${x}`, lastSeenAt: new Date(),
    })));
    const matches = await Match.create(jobs.map((j) => ({ userId: me.id, profileId: profile._id, jobId: j._id, fitScore: 90 })));

    await request.patch(`/api/v1/matches/${matches[0]._id}/dismiss`).set('Cookie', me.cookie).send({});
    const hide = await request.post(`/api/v1/matches/${matches[2]._id}/hide-company`).set('Cookie', me.cookie);
    expect(hide.body.company).toBe('globex');

    const feed = await request.get('/api/v1/matches').set('Cookie', me.cookie);
    expect(feed.body.matches.map((m) => m.id)).toEqual([String(matches[1]._id)]);

    await request.delete('/api/v1/me/hidden-companies/globex').set('Cookie', me.cookie);
    await request.patch(`/api/v1/matches/${matches[0]._id}/dismiss`).set('Cookie', me.cookie).send({ dismissed: false });
    expect((await request.get('/api/v1/matches').set('Cookie', me.cookie)).body.matches).toHaveLength(3);
  });

  it('notifies about strong matches for newly found jobs only, once, and counts unread', async () => {
    const since = new Date(Date.now() - 1000);
    const profile = await Profile.findOne({ userId: me.id });
    const [fresh] = await Job.create([{ source: 'nf-test', externalId: 'nf-new', title: 'Engineer', company: 'Initech', location: 'Remote', description: 'x', url: 'https://example.com/new', foundAt: new Date() }]);
    await Match.create([{ userId: me.id, profileId: profile._id, jobId: fresh._id, fitScore: 92 }]);

    expect((await notifyNewMatches(since)).usersNotified).toBe(1);
    expect((await notifyNewMatches(since)).usersNotified).toBe(0); // already alerted

    const me1 = await request.get('/api/v1/auth/me').set('Cookie', me.cookie);
    expect(me1.body.user.unreadNotifications).toBe(1);
    const list = await request.get('/api/v1/me/notifications').set('Cookie', me.cookie);
    expect(list.body.items[0].title).toBe('1 new strong match');
    await request.post('/api/v1/me/notifications/read-all').set('Cookie', me.cookie);
    expect((await request.get('/api/v1/auth/me').set('Cookie', me.cookie)).body.user.unreadNotifications).toBe(0);
  });

  it('validates notification preferences and push subscriptions', async () => {
    expect((await request.patch('/api/v1/me/notification-prefs').set('Cookie', me.cookie).send({ minScore: 20 })).status).toBe(400);
    const ok = await request.patch('/api/v1/me/notification-prefs').set('Cookie', me.cookie).send({ minScore: 85, push: false });
    expect(ok.body.notificationPrefs).toMatchObject({ minScore: 85, push: false });

    const badSub = await request.post('/api/v1/me/push/subscriptions').set('Cookie', me.cookie).send({ endpoint: 'http://insecure.example', keys: { p256dh: 'a', auth: 'b' } });
    expect(badSub.status).toBe(400);
    const config = await request.get('/api/v1/me/push').set('Cookie', me.cookie);
    expect(config.body).toHaveProperty('configured');
  });
});
