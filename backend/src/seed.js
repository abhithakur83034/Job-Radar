import { connectDatabase } from './config/db.js';
import mongoose from 'mongoose';
import { User } from './models/User.js';
import { Profile } from './models/Profile.js';
import { Resume } from './models/Resume.js';
import { Job } from './models/Job.js';
import { Match } from './models/Match.js';
import { hash } from '@node-rs/argon2';
import { fetchAllBoardListings } from './utils/connectors.js';
import { scoreListing } from './utils/scoring.js';

async function seed() {
  await connectDatabase();
  console.log('[Seed] Connected to database.');

  let user = await User.findOne({ email: 'abhi@example.com' });
  if (!user) {
    const passwordHash = await hash('Password123!', {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });
    user = await User.create({
      name: 'Abhi',
      email: 'abhi@example.com',
      passwordHash,
      plan: 'free',
    });
    console.log('[Seed] Created default user: abhi@example.com');
  } else {
    console.log('[Seed] User abhi@example.com already exists.');
  }

  let profile = await Profile.findOne({ userId: user._id });
  if (!profile) {
    profile = await Profile.create({
      userId: user._id,
      name: 'Senior Frontend Engineer',
      titles: ['Senior Frontend Engineer', 'Frontend Developer', 'Fullstack Engineer'],
      keywords: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'Node.js', 'JavaScript'],
      locations: ['Remote', 'San Francisco', 'New York'],
      seniority: 'senior',
      salaryMin: 140000,
      salaryMax: 180000,
      fitThreshold: 60,
    });
    console.log('[Seed] Created search profile for user.');
  }

  let resume = await Resume.findOne({ userId: user._id });
  if (!resume) {
    resume = await Resume.create({
      userId: user._id,
      fileUrl: '/uploads/resumes/demo_resume.pdf',
      parsedData: {
        summary: 'Experienced Senior Frontend Developer specialized in React, Next.js, and TypeScript architectures.',
        skills: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'Node.js', 'JavaScript', 'REST APIs'],
        roles: ['Senior Frontend Engineer', 'Frontend Developer'],
        experience: '5+ years building modern web applications.',
      },
      uploadedAt: new Date(),
    });
    console.log('[Seed] Created starter resume.');
  }

  console.log('[Seed] Fetching live ATS job postings (Greenhouse & Lever)...');
  const tokens = ['gitlab', 'reddit', 'affirm', 'brex', 'canonical', 'datadog', 'stripe', 'cloudflare'];
  const listings = await fetchAllBoardListings(tokens);
  console.log(`[Seed] Ingested ${listings.length} job postings.`);

  let matchCount = 0;
  for (const listing of listings) {
    let job = await Job.findOne({ source: listing.source, externalId: listing.externalId });
    if (!job) {
      job = await Job.create({
        source: listing.source,
        externalId: listing.externalId,
        title: listing.title,
        company: listing.company,
        location: listing.location,
        description: listing.description,
        salaryText: listing.salaryText,
        url: listing.url,
        foundAt: new Date(),
      });
    }

    const score = scoreListing(resume, profile, listing);
    if (score.fitScore >= 60) {
      const existingMatch = await Match.findOne({
        userId: user._id,
        profileId: profile._id,
        jobId: job._id,
      });

      if (!existingMatch) {
        await Match.create({
          userId: user._id,
          profileId: profile._id,
          jobId: job._id,
          fitScore: score.fitScore,
          fitReason: score.fitReason,
          matchedSkills: score.matchedSkills,
          missingRequirements: score.missingRequirements,
          notifiedAt: new Date(),
        });
        matchCount++;
      }
    }
  }

  console.log(`[Seed] Seeded ${matchCount} matches into MongoDB.`);
  console.log('[Seed] Database seeding completed successfully.');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed] Error during seeding:', err);
  process.exit(1);
});

