import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Resume } from '../src/models/Resume.js';
import { Profile } from '../src/models/Profile.js';
import { env } from '../src/config/env.js';

const request = supertest(app);

describe('Resume Management & Data Isolation', () => {
  let userACookie;
  let userBCookie;
  let userAResumeId;

  beforeAll(async () => {
    const testDbUri = env.MONGODB_URI.replace(/\/[^/]+$/, '/job_radar_test');
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testDbUri);
    }
    await User.deleteMany({ email: /@resume-test\.com$/ });
    await Resume.deleteMany({});

    // Register User A
    const resA = await request.post('/api/v1/auth/register').send({
      name: 'User A',
      email: 'usera@resume-test.com',
      password: 'password123',
    });
    userACookie = resA.headers['set-cookie'];

    // Register User B
    const resB = await request.post('/api/v1/auth/register').send({
      name: 'User B',
      email: 'userb@resume-test.com',
      password: 'password123',
    });
    userBCookie = resB.headers['set-cookie'];
  });

  afterAll(async () => {
    await User.deleteMany({ email: /@resume-test\.com$/ });
    await Resume.deleteMany({});
    await mongoose.connection.close();
  });

  it('rejects unauthenticated resume upload', async () => {
    const res = await request.post('/api/v1/resumes').send({ fileUrl: 'test.pdf' });
    expect(res.status).toBe(401);
  });

  it('User A uploads a resume and receives enriched parsed metadata', async () => {
    const res = await request
      .post('/api/v1/resumes')
      .set('Cookie', userACookie)
      .send({
        fileUrl: 'Abhishek_Frontend_Engineer.pdf',
        parsedData: {
          summary: 'Senior Frontend Developer with 5 years experience',
          skills: ['React', 'TypeScript', 'Next.js'],
          roles: ['Senior Frontend Engineer'],
          experience: '5 years',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.resume).toBeDefined();
    expect(res.body.resume.fileUrl).toBe('Abhishek_Frontend_Engineer.pdf');
    expect(res.body.resume.parsedData.skills).toContain('React');
    expect(res.body.resume.parsedData.skills).toContain('TypeScript');
    userAResumeId = res.body.resume._id;
  });

  it('User A retrieves their latest resume', async () => {
    const res = await request.get('/api/v1/resumes/latest').set('Cookie', userACookie);
    expect(res.status).toBe(200);
    expect(res.body.resume._id).toBe(userAResumeId);
    expect(res.body.resume.fileUrl).toBe('Abhishek_Frontend_Engineer.pdf');
  });

  it('User B cannot see User A resume (data isolation)', async () => {
    const res = await request.get('/api/v1/resumes/latest').set('Cookie', userBCookie);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no resume found/i);

    const listRes = await request.get('/api/v1/resumes').set('Cookie', userBCookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.resumes.length).toBe(0);
  });
});
