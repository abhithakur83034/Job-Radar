import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Profile } from '../src/models/Profile.js';
import { env } from '../src/config/env.js';
import { identityFor } from './helpers.js';

const request = supertest(app);

describe('Data Isolation & Ownership Enforcement', () => {
  let userACookie;
  let userBCookie;
  let userAProfileId;

  beforeAll(async () => {
    const testDbUri = env.MONGODB_URI.replace(/\/[^/]+$/, '/job_radar_test');
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testDbUri);
    }
    await User.deleteMany({ email: /@isolation-test\.com$/ });
    await Profile.deleteMany({});

    // Register User A
    const resA = await request.post('/api/v1/auth/register').send({
      name: 'User A',
      email: 'usera@isolation-test.com',
      ...identityFor('usera@isolation-test.com'),
      password: 'password123',
    });
    userACookie = resA.headers['set-cookie'];

    // Register User B
    const resB = await request.post('/api/v1/auth/register').send({
      name: 'User B',
      email: 'userb@isolation-test.com',
      ...identityFor('userb@isolation-test.com'),
      password: 'password123',
    });
    userBCookie = resB.headers['set-cookie'];
  });

  afterAll(async () => {
    await User.deleteMany({ email: /@isolation-test\.com$/ });
    await Profile.deleteMany({});
    await mongoose.connection.close();
  });

  it('User A creates a search profile', async () => {
    const res = await request
      .post('/api/v1/profiles')
      .set('Cookie', userACookie)
      .send({
        name: 'Backend Roles A',
        titles: ['Backend Engineer'],
        keywords: ['Node.js', 'MongoDB'],
        locations: ['Remote'],
        seniority: 'senior',
      });

    expect(res.status).toBe(201);
    expect(res.body.profile).toBeDefined();
    expect(res.body.profile.name).toBe('Backend Roles A');
    userAProfileId = res.body.profile._id;
  });

  it('User A can view their own profile', async () => {
    const res = await request
      .get(`/api/v1/profiles/${userAProfileId}`)
      .set('Cookie', userACookie);

    expect(res.status).toBe(200);
    expect(res.body.profile._id).toBe(userAProfileId);
  });

  it('User B CANNOT view User A profile (returns 404 to avoid ID enumeration)', async () => {
    const res = await request
      .get(`/api/v1/profiles/${userAProfileId}`)
      .set('Cookie', userBCookie);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('User B CANNOT mutate User A profile (returns 404)', async () => {
    const res = await request
      .patch(`/api/v1/profiles/${userAProfileId}`)
      .set('Cookie', userBCookie)
      .send({ name: 'Hacked by B' });

    expect(res.status).toBe(404);

    // Verify User A profile was not modified
    const profile = await Profile.findById(userAProfileId);
    expect(profile.name).toBe('Backend Roles A');
  });

  it('User B CANNOT delete User A profile (returns 404)', async () => {
    const res = await request
      .delete(`/api/v1/profiles/${userAProfileId}`)
      .set('Cookie', userBCookie);

    expect(res.status).toBe(404);

    // Verify still in database
    const profile = await Profile.findById(userAProfileId);
    expect(profile).not.toBeNull();
  });

  it('Listing profiles is strictly isolated per user', async () => {
    // User A should see 1 profile
    const resA = await request.get('/api/v1/profiles').set('Cookie', userACookie);
    expect(resA.status).toBe(200);
    expect(resA.body.profiles.length).toBe(1);

    // User B should see 0 profiles
    const resB = await request.get('/api/v1/profiles').set('Cookie', userBCookie);
    expect(resB.status).toBe(200);
    expect(resB.body.profiles.length).toBe(0);
  });
});

