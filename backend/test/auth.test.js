import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { env } from '../src/config/env.js';
import { identityFor } from './helpers.js';

const request = supertest(app);

describe('Auth API & Multi-User Security Tests', () => {
  beforeAll(async () => {
    // Connect to test database in MongoDB
    const testDbUri = env.MONGODB_URI.replace(/\/[^/]+$/, '/job_radar_test');
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testDbUri);
    }
  });

  afterEach(async () => {
    // Clean up users created during tests
    await User.deleteMany({ email: /@test\.com$/ });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('GET /health returns 200 ok', async () => {
    const res = await request.get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('POST /api/v1/auth/register fails with invalid payload', async () => {
    const res = await request.post('/api/v1/auth/register').send({
      name: '',
      email: 'not-an-email',
      ...identityFor('not-an-email'),
      password: 'short',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('POST /api/v1/auth/register creates user, sets cookie, never returns passwordHash', async () => {
    const res = await request.post('/api/v1/auth/register').send({
      name: 'Alice Wonder',
      email: 'alice@test.com',
      ...identityFor('alice@test.com'),
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.name).toBe('Alice Wonder');
    expect(res.body.user.email).toBe('alice@test.com');
    expect(res.body.user.role).toBe('user');
    expect(res.body.user.passwordHash).toBeUndefined();

    // Check cookie
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some((c) => c.startsWith(`${env.SESSION_COOKIE_NAME}=`))).toBe(true);

    // Verify database record
    const inDb = await User.findOne({ email: 'alice@test.com' }).select('+passwordHash');
    expect(inDb).toBeDefined();
    expect(inDb.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('POST /api/v1/auth/register rejects duplicate email with 409', async () => {
    await request.post('/api/v1/auth/register').send({
      name: 'First User',
      email: 'duplicate@test.com',
      ...identityFor('duplicate@test.com'),
      password: 'password123',
    });

    const res = await request.post('/api/v1/auth/register').send({
      name: 'Second User',
      email: 'DUPLICATE@TEST.COM',
      ...identityFor('DUPLICATE@TEST.COM'), // Test case insensitivity
      password: 'password123',
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('POST /api/v1/auth/login rejects wrong password with 401', async () => {
    await request.post('/api/v1/auth/register').send({
      name: 'Bob Builder',
      email: 'bob@test.com',
      ...identityFor('bob@test.com'),
      password: 'correctpassword',
    });

    const res = await request.post('/api/v1/auth/login').send({
      email: 'bob@test.com',
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid username\/mobile number or password/i);
  });

  it('POST /api/v1/auth/login succeeds and issues session cookie', async () => {
    await request.post('/api/v1/auth/register').send({
      name: 'Carol Singer',
      email: 'carol@test.com',
      ...identityFor('carol@test.com'),
      password: 'mypassword123',
    });

    const res = await request.post('/api/v1/auth/login').send({
      email: 'CAROL@TEST.COM',
      password: 'mypassword123',
    });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('carol@test.com');
    expect(res.body.user.passwordHash).toBeUndefined();

    const cookies = res.headers['set-cookie'];
    expect(cookies.some((c) => c.startsWith(`${env.SESSION_COOKIE_NAME}=`))).toBe(true);
  });

  it('GET /api/v1/auth/me enforces authentication and returns current user', async () => {
    // Unauthenticated
    const unauth = await request.get('/api/v1/auth/me');
    expect(unauth.status).toBe(401);

    // Register to get cookie
    const reg = await request.post('/api/v1/auth/register').send({
      name: 'Dave Dev',
      email: 'dave@test.com',
      ...identityFor('dave@test.com'),
      password: 'password123',
    });

    const cookie = reg.headers['set-cookie'];

    // Authenticated
    const auth = await request.get('/api/v1/auth/me').set('Cookie', cookie);
    expect(auth.status).toBe(200);
    expect(auth.body.user.name).toBe('Dave Dev');
    expect(auth.body.user.email).toBe('dave@test.com');
  });

  it('POST /api/v1/auth/logout clears the session cookie', async () => {
    const res = await request.post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    // Cookie expires in the past
    expect(cookies.some((c) => c.includes(`${env.SESSION_COOKIE_NAME}=;`))).toBe(true);
  });
});

