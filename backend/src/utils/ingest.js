import { Job } from '../models/Job.js';
import { Match } from '../models/Match.js';
import { Profile } from '../models/Profile.js';
import { Resume } from '../models/Resume.js';
import { scoreListing } from './scoring.js';

const key = (source, externalId) => `${source}:${externalId}`;

// Optional canonical fields: only written when a source provides them, so a
// sparser source never blanks out data a richer refresh stored earlier.
const OPTIONAL_FIELDS = [
  'applyUrl', 'postedAt', 'remoteType', 'employmentType', 'salaryMin', 'salaryMax', 'salaryCurrency',
];

/**
 * Upsert normalized listings into the shared Job collection (one round trip),
 * deduplicated by (source, externalId). Repeated refreshes update in place.
 * @returns {{ newListings: number, jobIdByKey: Map<string, import('mongoose').Types.ObjectId> }}
 */
export async function upsertListings(listings) {
  const now = new Date();
  const unique = [...new Map(listings.map((l) => [key(l.source, l.externalId), l])).values()];

  let newListings = 0;
  if (unique.length > 0) {
    const result = await Job.bulkWrite(
      unique.map((l) => {
        const $set = {
          title: l.title,
          company: l.company,
          location: l.location,
          description: l.description || l.title,
          salaryText: l.salaryText ?? null,
          url: l.url,
          lastSeenAt: now,
          isActive: true,
        };
        for (const field of OPTIONAL_FIELDS) {
          if (l[field] !== undefined && l[field] !== null) $set[field] = l[field];
        }
        return {
          updateOne: {
            filter: { source: l.source, externalId: l.externalId },
            update: { $set, $setOnInsert: { foundAt: now } },
            upsert: true,
          },
        };
      }),
      { ordered: false }
    );
    newListings = result.upsertedCount;
  }

  const idsBySource = Object.entries(
    unique.reduce((acc, l) => ((acc[l.source] ||= []).push(l.externalId), acc), {})
  );
  const jobs = idsBySource.length
    ? await Job.find({
        $or: idsBySource.map(([source, ids]) => ({ source, externalId: { $in: ids } })),
      }).select('_id source externalId')
    : [];

  return { newListings, jobIdByKey: new Map(jobs.map((j) => [key(j.source, j.externalId), j._id])) };
}

/**
 * Score listings against every search profile of one user; insert new matches
 * above the profile's threshold and refresh scores of existing ones.
 * @returns {Promise<number>} number of new matches
 */
export async function scoreListingsForUser(userId, listings, jobIdByKey) {
  const [profiles, resume] = await Promise.all([
    Profile.find({ userId }),
    Resume.findOne({ userId }).sort({ uploadedAt: -1 }),
  ]);
  if (profiles.length === 0 || listings.length === 0) return 0;

  const existingMatches = await Match.find({
    userId,
    profileId: { $in: profiles.map((p) => p._id) },
    jobId: { $in: [...jobIdByKey.values()] },
  }).select('profileId jobId fitScore');
  const existingByKey = new Map(existingMatches.map((m) => [`${m.profileId}:${m.jobId}`, m]));

  const now = new Date();
  const ops = [];
  let newMatches = 0;
  for (const listing of listings) {
    const jobId = jobIdByKey.get(key(listing.source, listing.externalId));
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
          ops.push({ updateOne: { filter: { _id: existing._id }, update: { $set: scoreFields } } });
        }
      } else if (score.fitScore >= (profile.fitThreshold || 60)) {
        ops.push({
          insertOne: { document: { userId, profileId: profile._id, jobId, ...scoreFields, notifiedAt: now } },
        });
        existingByKey.set(`${profile._id}:${jobId}`, { fitScore: score.fitScore });
        newMatches++;
      }
    }
  }
  if (ops.length > 0) {
    await Match.bulkWrite(ops, { ordered: false });
  }
  return newMatches;
}

/**
 * Upsert listings, then score them for one user. Used by the employer-board scan
 * and the Gmail job-alert import.
 */
export async function ingestListings(userId, listings) {
  const { newListings, jobIdByKey } = await upsertListings(listings);
  const newMatches = await scoreListingsForUser(userId, listings, jobIdByKey);
  return { newListings, newMatches };
}

/**
 * After a SUCCESSFUL, complete fetch of one employer board, mark that board's jobs
 * that have not been listed for `graceDays` as inactive (likely closed). Never call
 * this after a failed or partial fetch.
 */
export async function deactivateMissingBoardJobs(source, company, graceDays) {
  const cutoff = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000);
  const result = await Job.updateMany(
    { source, company, isActive: { $ne: false }, lastSeenAt: { $lt: cutoff } },
    { $set: { isActive: false } }
  );
  return result.modifiedCount;
}
