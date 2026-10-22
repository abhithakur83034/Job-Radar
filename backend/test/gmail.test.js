import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { GmailConnection } from '../src/models/GmailConnection.js';
import { env } from '../src/config/env.js';
import { identityFor } from './helpers.js';

const request = supertest(app);

describe('Gmail job-alert import', () => {
  let cookie;
  const saved = {};

  beforeAll(async () => {
    const testDbUri = env.MONGODB_URI.replace(/\/[^/]+$/, '/job_radar_test');
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testDbUri);
    }
    await User.deleteMany({ email: /@gmail-test\.com$/ });
    const res = await request.post('/api/v1/auth/register').send({
      name: 'Gmail Tester',
      email: 'user@gmail-test.com',
      ...identityFor('user@gmail-test.com'),
      password: 'password123',
    });
    cookie = res.headers['set-cookie'];
    for (const key of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'GMAIL_TOKEN_KEY']) {
      saved[key] = env[key];
    }
  });

  afterAll(async () => {
    Object.assign(env, saved);
    const users = await User.find({ email: /@gmail-test\.com$/ });
    await GmailConnection.deleteMany({ userId: { $in: users.map((u) => u._id) } });
    await User.deleteMany({ email: /@gmail-test\.com$/ });
    await mongoose.connection.close();
  });

  it('requires authentication', async () => {
    expect((await request.get('/api/v1/gmail/status')).status).toBe(401);
    expect((await request.get('/api/v1/gmail/connect')).status).toBe(401);
  });

  it('reports not configured and refuses to connect without server credentials', async () => {
    Object.assign(env, { GOOGLE_CLIENT_ID: undefined, GMAIL_TOKEN_KEY: undefined });
    const status = await request.get('/api/v1/gmail/status').set('Cookie', cookie);
    expect(status.body).toMatchObject({ configured: false, connected: false });
    expect((await request.get('/api/v1/gmail/connect').set('Cookie', cookie)).status).toBe(503);
  });

  describe('when configured', () => {
    beforeAll(() => {
      Object.assign(env, {
        GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: 'test-secret',
        GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/v1/gmail/callback',
        GMAIL_TOKEN_KEY: Buffer.alloc(32, 1).toString('base64'),
      });
    });

    it('redirects to Google with read-only scope, offline access, state and PKCE', async () => {
      const res = await request.get('/api/v1/gmail/connect').set('Cookie', cookie);
      expect(res.status).toBe(302);

      const url = new URL(res.headers.location);
      expect(url.origin).toBe('https://accounts.google.com');
      expect(url.searchParams.get('scope')).toBe('openid email https://www.googleapis.com/auth/gmail.readonly');
      expect(url.searchParams.get('access_type')).toBe('offline');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('state')).toMatch(/^[\w-]{43}$/);

      const stateCookie = res.headers['set-cookie'].find((c) => c.startsWith('jr_gmail_oauth='));
      expect(stateCookie).toMatch(/HttpOnly/i);
      expect(stateCookie).toMatch(/Path=\/api\/v1\/gmail/);
      expect(stateCookie).toMatch(/SameSite=Lax/i);
    });

    it('rejects a callback whose state does not match the cookie', async () => {
      const connect = await request.get('/api/v1/gmail/connect').set('Cookie', cookie);
      const stateCookie = connect.headers['set-cookie'].find((c) => c.startsWith('jr_gmail_oauth=')).split(';')[0];

      const res = await request
        .get('/api/v1/gmail/callback?code=abc&state=forged-state-value-forged-state-value-12345')
        .set('Cookie', [...cookie, stateCookie]);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/profile?gmail=invalid_state');
      expect(await GmailConnection.countDocuments()).toBe(0);
    });

    it('rejects a callback with no state cookie (e.g. CSRF from another site)', async () => {
      const res = await request.get('/api/v1/gmail/callback?code=abc&state=x').set('Cookie', cookie);
      expect(res.headers.location).toBe('/profile?gmail=invalid_state');
    });

    it('handles the user declining consent', async () => {
      const res = await request.get('/api/v1/gmail/callback?error=access_denied').set('Cookie', cookie);
      expect(res.headers.location).toBe('/profile?gmail=denied');
    });

    it('sync without a connection is a 404 and disconnect is idempotent', async () => {
      expect((await request.post('/api/v1/gmail/sync').set('Cookie', cookie)).status).toBe(404);
      expect((await request.delete('/api/v1/gmail').set('Cookie', cookie)).body).toEqual({ success: true });
    });

    it('never exposes the encrypted token through status', async () => {
      const user = await User.findOne({ email: 'user@gmail-test.com' });
      await GmailConnection.create({ userId: user._id, email: 'me@gmail.com', encryptedRefreshToken: 'v1:a:b:c' });
      const status = await request.get('/api/v1/gmail/status').set('Cookie', cookie);
      expect(status.body).toMatchObject({ configured: true, connected: true, email: 'me@gmail.com' });
      expect(JSON.stringify(status.body)).not.toContain('v1:a:b:c');
    });
  });
});
