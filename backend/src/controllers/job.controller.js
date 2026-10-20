import { Job } from '../models/Job.js';
import { Match } from '../models/Match.js';
import { Profile } from '../models/Profile.js';
import { Resume } from '../models/Resume.js';
import { fetchAllBoardListings } from '../utils/connectors.js';
import { scoreListing } from '../utils/scoring.js';

export async function syncListings(req, res) {
  const { boardTokens } = req.body;
  const tokens = Array.isArray(boardTokens) && boardTokens.length > 0
    ? boardTokens
    : ['gitlab', 'reddit', 'affirm', 'brex', 'canonical', 'datadog', 'stripe', 'cloudflare'];

  const normalized = await fetchAllBoardListings(tokens);

  let newListingsCount = 0;
  let newMatchesCount = 0;

  // Find user profiles and resume
  const profiles = await Profile.find({ userId: req.user._id });
  const resume = await Resume.findOne({ userId: req.user._id }).sort({ uploadedAt: -1 });

  for (const listing of normalized) {
    let job = await Job.findOne({ source: listing.source, externalId: listing.externalId });
    let isNew = false;

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
      isNew = true;
      newListingsCount++;
    }

    // Score against each active profile of the authenticated user
    for (const profile of profiles) {
      const score = scoreListing(resume, profile, listing);
      const threshold = profile.fitThreshold || 60;

      if (score.fitScore >= threshold) {
        const existingMatch = await Match.findOne({
          userId: req.user._id,
          profileId: profile._id,
          jobId: job._id,
        });

        if (!existingMatch) {
          await Match.create({
            userId: req.user._id,
            profileId: profile._id,
            jobId: job._id,
            fitScore: score.fitScore,
            fitReason: score.fitReason,
            matchedSkills: score.matchedSkills,
            missingRequirements: score.missingRequirements,
            notifiedAt: new Date(),
          });
          newMatchesCount++;
        }
      }
    }
  }

  return res.json({
    success: true,
    listingsSeen: normalized.length,
    newListings: newListingsCount,
    newMatches: newMatchesCount,
  });
}

export async function listJobs(req, res) {
  const jobs = await Job.find().sort({ foundAt: -1 }).limit(100);
  return res.json({ jobs });
}

