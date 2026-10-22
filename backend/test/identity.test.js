import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { env } from '../src/config/env.js';
import { normalizeMobile, identifierQuery } from '../src/utils/identity.js';

const request = supertest(app);
const PASSWORD = 'password123';

describe('identity helpers', () => {
  it('normalizes Indian and international mobile numbers to E.164', () => {
    expect(normalizeMobile('98765 43210')).toBe('+919876543210');
    expect(normalizeMobile('+91 98765-43210')).toBe('+919876543210');
    expect(normalizeMobile('919876543210')).toBe('+919876543210');
    expect(normalizeMobile('+1 (415) 555-0100')).toBe('+14155550100');
    expect(normalizeMobile('12345')).toBeNull();
    expect(normalizeMobile('5876543210')).toBeNull(); // Indian mobiles start 6–9
    expect(normalizeMobile('abc')).toBeNull();
  });

  it('routes a login identifier to email, mobile or username', () => {
    expect(identifierQuery('Me@Example.com')).toEqual({ email: 'me@example.com' });
    expect(identifierQuery('9876543210')).toEqual({ mobile: '+919876543210' });
    expect(identifierQuery('Abhi_Dev')).toEqual({ username: 'abhi_dev' });
  });
});

describe('Username / mobile sign-in', () => {
  let cookie;

  beforeAll(async () => {
    const testDbUri = env.MONGODB_URI.replace(/\/[^/]+$/, '/job_radar_test');
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testDbUri);
    }
    await User.syncIndexes();
    await User.deleteMany({ email: /@identity-test\.com$/ });

    const res = await request.post('/api/v1/auth/register').send({
      name: 'Riya Sharma',
      username: 'Riya.Sharma',
      mobile: '98111 22233',
      email: 'riya@identity-test.com',
      password: PASSWORD,
    });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ username: 'riya.sharma', mobile: '+919811122233' });
    cookie = res.headers['set-cookie'];
  });

  afterAll(async () => {
    await User.deleteMany({ email: /@identity-test\.com$/ });
    await mongoose.connection.close();
  });

  it.each([
    ['username (any case)', 'RIYA.SHARMA'],
    ['10-digit mobile', '9811122233'],
    ['mobile with +91 and spaces', '+91 98111 22233'],
    ['email (older accounts)', 'riya@identity-test.com'],
  ])('signs in with %s', async (_label, identifier) => {
    const res = await request.post('/api/v1/auth/login').send({ identifier, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('riya.sharma');
  });

  it('gives the same generic error for unknown users and wrong passwords', async () => {
    const unknown = await request.post('/api/v1/auth/login').send({ identifier: 'nobody_here', password: PASSWORD });
    const wrong = await request.post('/api/v1/auth/login').send({ identifier: 'riya.sharma', password: 'wrong-pass' });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error).toBe(wrong.body.error);
  });

  it('requires an identifier and password', async () => {
    const res = await request.post('/api/v1/auth/login').send({ password: PASSWORD });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/username or mobile number is required/i);
  });

  it('rejects invalid usernames and mobile numbers at registration', async () => {
    const base = { name: 'X', email: 'x@identity-test.com', password: PASSWORD };
    const badUsername = await request.post('/api/v1/auth/register').send({ ...base, username: '9lives', mobile: '9811100000' });
    expect(badUsername.status).toBe(400);
    expect(badUsername.body.error).toMatch(/start with a letter/i);

    const badMobile = await request.post('/api/v1/auth/register').send({ ...base, username: 'valid_name', mobile: '12345' });
    expect(badMobile.status).toBe(400);
    expect(badMobile.body.error).toMatch(/valid mobile number/i);
  });

  it('rejects a username or mobile number that is already taken', async () => {
    const base = { name: 'Copy', password: PASSWORD };
    const sameUsername = await request.post('/api/v1/auth/register').send({
      ...base, email: 'copy1@identity-test.com', username: 'riya.sharma', mobile: '9811100001',
    });
    expect(sameUsername.status).toBe(409);
    expect(sameUsername.body.error).toMatch(/username/);

    const sameMobile = await request.post('/api/v1/auth/register').send({
      ...base, email: 'copy2@identity-test.com', username: 'someone_else', mobile: '+919811122233',
    });
    expect(sameMobile.status).toBe(409);
    expect(sameMobile.body.error).toMatch(/mobile number/);
  });

  it('lets an older email-only account add a username and mobile number', async () => {
    const legacy = await User.create({
      name: 'Old Account',
      email: 'legacy@identity-test.com',
      passwordHash: (await User.findOne({ username: 'riya.sharma' }).select('+passwordHash')).passwordHash,
    });
    const login = await request.post('/api/v1/auth/login').send({ email: 'legacy@identity-test.com', password: PASSWORD });
    expect(login.status).toBe(200);
    const legacyCookie = login.headers['set-cookie'];

    const taken = await request.patch('/api/v1/auth/me').set('Cookie', legacyCookie).send({ username: 'riya.sharma' });
    expect(taken.status).toBe(409);

    const update = await request
      .patch('/api/v1/auth/me')
      .set('Cookie', legacyCookie)
      .send({ name: 'Old Account Renamed', username: 'old_account', mobile: '7000000001' });
    expect(update.status).toBe(200);
    expect(update.body.user).toMatchObject({ name: 'Old Account Renamed', username: 'old_account', mobile: '+917000000001' });

    const byUsername = await request.post('/api/v1/auth/login').send({ identifier: 'old_account', password: PASSWORD });
    expect(byUsername.status).toBe(200);
    expect(byUsername.body.user.id).toBe(String(legacy._id));
  });

  it('only accepts uploaded images as avatar URLs', async () => {
    const res = await request
      .patch('/api/v1/auth/me')
      .set('Cookie', cookie)
      .send({ avatarUrl: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
  });
});
