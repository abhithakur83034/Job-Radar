import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { env } from '../src/config/env.js';

const request = supertest(app);

// Minimal 1x1 valid PNG buffer for testing
const TINY_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

describe('Multer Image Upload & Avatar Management', () => {
  let userCookie;
  let uploadedAvatarUrl;

  beforeAll(async () => {
    const testDbUri = env.MONGODB_URI.replace(/\/[^/]+$/, '/job_radar_test');
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testDbUri);
    }
    await User.deleteMany({ email: /@upload-test\.com$/ });

    const res = await request.post('/api/v1/auth/register').send({
      name: 'Upload Candidate',
      email: 'candidate@upload-test.com',
      password: 'password123',
    });
    userCookie = res.headers['set-cookie'];
  });

  afterAll(async () => {
    await User.deleteMany({ email: /@upload-test\.com$/ });
    await mongoose.connection.close();
  });

  it('rejects unauthenticated avatar upload', async () => {
    const res = await request
      .post('/api/v1/upload/avatar')
      .attach('avatar', TINY_PNG_BUFFER, 'avatar.png');

    expect(res.status).toBe(401);
  });

  it('rejects invalid file types (e.g. text file)', async () => {
    const res = await request
      .post('/api/v1/upload/avatar')
      .set('Cookie', userCookie)
      .attach('avatar', Buffer.from('not an image'), 'hacker.txt');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/only jpeg, png, webp, and gif/i);
  });

  it('successfully uploads user avatar using multer', async () => {
    const res = await request
      .post('/api/v1/upload/avatar')
      .set('Cookie', userCookie)
      .attach('avatar', TINY_PNG_BUFFER, 'profile-pic.png');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.avatarUrl).toMatch(/^\/uploads\/images\/\d+-[a-f0-9]+\.png$/);
    expect(res.body.user.avatarUrl).toBe(res.body.avatarUrl);
    uploadedAvatarUrl = res.body.avatarUrl;

    // Verify on disk
    const diskPath = path.join(process.cwd(), uploadedAvatarUrl);
    expect(fs.existsSync(diskPath)).toBe(true);
  });

  it('serves uploaded image file statically via Express', async () => {
    const res = await request.get(uploadedAvatarUrl);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/png/i);
  });

  it('reflects updated avatarUrl in /api/v1/auth/me', async () => {
    const res = await request.get('/api/v1/auth/me').set('Cookie', userCookie);
    expect(res.status).toBe(200);
    expect(res.body.user.avatarUrl).toBe(uploadedAvatarUrl);
  });

  it('supports general image upload via /api/v1/upload/image', async () => {
    const res = await request
      .post('/api/v1/upload/image')
      .set('Cookie', userCookie)
      .attach('image', TINY_PNG_BUFFER, 'banner.png');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.imageUrl).toMatch(/^\/uploads\/images\/\d+-[a-f0-9]+\.png$/);
  });
});
