import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { PasswordResetToken } from '../src/models/PasswordResetToken.js';
import { createResetToken, hashToken } from '../src/services/passwordReset.service.js';
import { identityFor } from './helpers.js';

const request = supertest(app);
const EMAIL = 'reset@reset-test.com';

describe('Forgot / reset password', () => {
  let userId;
  let cookie;

  beforeAll(async () => {
    const testDbUri = env.MONGODB_URI.replace(/\/[^/]+$/, '/job_radar_test');
    if (mongoose.connection.readyState === 0) await mongoose.connect(testDbUri);
    await User.deleteMany({ email: /@reset-test\.com$/ });
    const res = await request.post('/api/v1/auth/register').send({ name: 'Reset Me', email: EMAIL, ...identityFor(EMAIL), password: 'oldPassword1' });
    userId = res.body.user.id;
    cookie = res.headers['set-cookie'];
  });

  afterAll(async () => {
    const ids = (await User.find({ email: /@reset-test\.com$/ })).map((u) => u._id);
    await PasswordResetToken.deleteMany({ userId: { $in: ids } });
    await User.deleteMany({ email: /@reset-test\.com$/ });
    await mongoose.connection.close();
  });

  it('answers identically for known and unknown accounts, storing only a token hash', async () => {
    const known = await request.post('/api/v1/auth/forgot-password').send({ identifier: identityFor(EMAIL).username });
    const unknown = await request.post('/api/v1/auth/forgot-password').send({ identifier: 'nobody_at_all' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body.message).toBe(unknown.body.message);

    const tokens = await PasswordResetToken.find({ userId }).lean();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokens[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('resets the password once, signs out old sessions, and rejects reuse', async () => {
    const { token, url } = await createResetToken(userId);
    expect(url).toContain(`/reset-password?token=${token}`);
    expect(await PasswordResetToken.exists({ tokenHash: hashToken(token) })).toBeTruthy();

    // Wait past the 1s JWT iat granularity so the old session predates the change
    await new Promise((r) => setTimeout(r, 1100));
    const weak = await request.post('/api/v1/auth/reset-password').send({ token, password: 'short' });
    expect(weak.status).toBe(400);

    const ok = await request.post('/api/v1/auth/reset-password').send({ token, password: 'newPassword1' });
    expect(ok.status).toBe(200);

    expect((await request.get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(401);
    expect((await request.post('/api/v1/auth/login').send({ email: EMAIL, password: 'oldPassword1' })).status).toBe(401);
    const login = await request.post('/api/v1/auth/login').send({ email: EMAIL, password: 'newPassword1' });
    expect(login.status).toBe(200);
    expect((await request.get('/api/v1/auth/me').set('Cookie', login.headers['set-cookie'])).status).toBe(200);

    const reuse = await request.post('/api/v1/auth/reset-password').send({ token, password: 'anotherPass1' });
    expect(reuse.status).toBe(400);
    expect(reuse.body.code).toBe('INVALID_RESET_TOKEN');
  });

  it('rejects expired, unknown and malformed tokens', async () => {
    const { token } = await createResetToken(userId);
    await PasswordResetToken.updateOne({ tokenHash: hashToken(token) }, { expiresAt: new Date(Date.now() - 1000) });
    expect((await request.post('/api/v1/auth/reset-password').send({ token, password: 'newPassword2' })).status).toBe(400);
    expect((await request.post('/api/v1/auth/reset-password').send({ token: 'x'.repeat(43), password: 'newPassword2' })).status).toBe(400);
    expect((await request.post('/api/v1/auth/reset-password').send({ token: '<script>', password: 'newPassword2' })).status).toBe(400);
  });

  it('lets an admin create a one-time link, audited without the link itself', async () => {
    const adminEmail = 'admin@reset-test.com';
    const adminReg = await request.post('/api/v1/auth/register').send({ name: 'Admin', email: adminEmail, ...identityFor(adminEmail), password: 'password123' });
    await User.updateOne({ _id: adminReg.body.user.id }, { role: 'admin' });

    const regular = await request.post(`/api/v1/admin/users/${userId}/password-reset-link`).send({ reason: 'locked out' });
    expect(regular.status).toBe(401);

    const res = await request
      .post(`/api/v1/admin/users/${userId}/password-reset-link`)
      .set('Cookie', adminReg.headers['set-cookie'])
      .send({ reason: 'User locked out, no email access' });
    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/\/reset-password\?token=[\w-]{40,}$/);

    const log = await AuditLog.findOne({ action: 'user.password-reset-link', targetId: userId }).lean();
    expect(log.reason).toBe('User locked out, no email access');
    expect(JSON.stringify(log)).not.toContain(res.body.url.split('token=')[1]);
    await AuditLog.deleteMany({ targetId: userId });
  });
});
