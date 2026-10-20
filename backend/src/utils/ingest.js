import { Job } from '../models/Job.js';
import { Match } from '../models/Match.js';
import { Profile } from '../models/Profile.js';
import { Resume } from '../models/Resume.js';
import { scoreListing } from './scoring.js';

/**
 * Upsert normalized listings into the shared Job collection, then score them
 * against every search profile of the user and record new/refreshed matches.
 * Used by both the company job-board scan and the Gmail job-alert import.
 */
export async function ingestListings(userId, listings) {
  const now = new Date();

  // 1. Upsert all listings in one round trip; refresh details on existing jobs
  let newListings = 0;
  if (listings.length > 0) {
    const jobResult = await Job.bulkWrite(
      listings.map((l) => ({
        updateOne: {
          filter: { source: l.source, externalId: l.externalId },
          update: {
            $set: {
              title: l.title,
              company: l.company,
              location: l.location,
              description: l.description || l.title,
              salaryText: l.salaryText,
              url: l.url,
              lastSeenAt: now,
            },
            $setOnInsert: { foundAt: now },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );
    newListings = jobResult.upsertedCount;
  }

  // 2. Load the job ids and this user's existing matches in bulk
  const idsBySource = Object.entries(
    listings.reduce((acc, l) => ((acc[l.source] ||= []).push(l.externalId), acc), {})
  );
  const jobs = idsBySource.length
    ? await Job.find({
        $or: idsBySource.map(([source, ids]) => ({ source, externalId: { $in: ids } })),
      }).select('_id source externalId')
    : [];
  const jobIdByKey = new Map(jobs.map((j) => [`${j.source}:${j.externalId}`, j._id]));

  const [profiles, resume] = await Promise.all([
    Profile.find({ userId: userId }),
    Resume.findOne({ userId: userId }).sort({ uploadedAt: -1 }),
  ]);

  const existingMatches = profiles.length
    ? await Match.find({
        userId: userId,
        profileId: { $in: profiles.map((p) => p._id) },
        jobId: { $in: jobs.map((j) => j._id) },
      }).select('profileId jobId fitScore')
    : [];
  const existingByKey = new Map(existingMatches.map((m) => [`${m.profileId}:${m.jobId}`, m]));

  // 3. Score in memory, then write new matches and refreshed scores in one round trip
  const matchOps = [];
  let newMatches = 0;
  for (const listing of listings) {
    const jobId = jobIdByKey.get(`${listing.source}:${listing.externalId}`);
    if (!jobId) continue;

    for (const profile of profiles) {
      const score = scoreListing(resume, profile, listing);
      const existing = existingByKey.get(`${profile._id}:${jobId}`);
      const scoreFields = {
        fitScore: score.fitScore,
        fitReason: score.fitReason,
        matchedSkills: score.matchedSkills,
        missingRequirements: score.missingRequirements,
      };

      if (existing) {
        // Keep existing matches (they may be saved/applied) but refresh their score
        if (existing.fitScore !== score.fitScore) {
          matchOps.push({ updateOne: { filter: { _id: existing._id }, update: { $set: scoreFields } } });
        }
      } else if (score.fitScore >= (profile.fitThreshold || 60)) {
        matchOps.push({
          insertOne: {
            document: { userId: userId, profileId: profile._id, jobId, ...scoreFields, notifiedAt: now },
          },
        });
        newMatches++;
      }
    }
  }
  if (matchOps.length > 0) {
    await Match.bulkWrite(matchOps, { ordered: false });
  }


  return { newListings, newMatches };
}
