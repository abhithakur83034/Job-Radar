import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Resume } from '../src/models/Resume.js';
import { env } from '../src/config/env.js';

const request = supertest(app);

const SAMPLE_PDF_BUFFER = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n200\n%%EOF'
);

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

  it('User A retrieves their latest resume metadata', async () => {
    const res = await request.get('/api/v1/resumes/latest').set('Cookie', userACookie);
    expect(res.status).toBe(200);
    expect(res.body.resume._id).toBe(userAResumeId);
    expect(res.body.resume.fileUrl).toBe('Abhishek_Frontend_Engineer.pdf');
  });

  it('User A uploads a real PDF file binary using Multer', async () => {
    const res = await request
      .post('/api/v1/resumes/upload')
      .set('Cookie', userACookie)
      .attach('resume', SAMPLE_PDF_BUFFER, 'RealCandidateResume.pdf');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.resume.fileUrl).toMatch(/^\/uploads\/resumes\/\d+-.+\.pdf$/);
    expect(res.body.resume.fileName).toBe('RealCandidateResume.pdf');
  });

  it('User A views their uploaded résumé file inline (Content-Type: application/pdf)', async () => {
    const res = await request.get('/api/v1/resumes/view/latest').set('Cookie', userACookie);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/i);
    expect(res.headers['content-disposition']).toMatch(/inline/i);
  });

  it('User A downloads their uploaded résumé file (Content-Disposition: attachment)', async () => {
    const res = await request.get('/api/v1/resumes/download/latest').set('Cookie', userACookie);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment/i);
  });

  it('User B cannot see or view User A resume (data isolation)', async () => {
    const res = await request.get('/api/v1/resumes/latest').set('Cookie', userBCookie);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no resume found/i);

    const viewRes = await request.get('/api/v1/resumes/view/latest').set('Cookie', userBCookie);
    expect(viewRes.status).toBe(404);

    const listRes = await request.get('/api/v1/resumes').set('Cookie', userBCookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.resumes.length).toBe(0);
  });
});
