import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { fetchAllBoardListings } from '../utils/connectors.js';
import { ingestListings, deactivateMissingBoardJobs } from '../utils/ingest.js';
import { env } from '../config/env.js';

const DEFAULT_COMPANIES = ['gitlab', 'reddit', 'affirm', 'brex', 'canonical', 'datadog'];
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,62}$/;

function cleanSlugs(input) {
  if (!Array.isArray(input)) return [];
  const slugs = input.map((s) => String(s).trim().toLowerCase()).filter((s) => SLUG_PATTERN.test(s));
  return [...new Set(slugs)].slice(0, 50);
}

let cachedJobs = null;
let cachedJobsExpiresAt = 0;

export async function syncListings(req, res) {
  const requested = cleanSlugs(req.body?.boardTokens);
  const tokens = requested.length > 0 ? requested : DEFAULT_COMPANIES;

  const { listings, companies } = await fetchAllBoardListings(tokens);
  const { newListings, newMatches } = await ingestListings(req.user._id, listings);

  // A successful board fetch is that company's complete list, so jobs it no longer
  // lists (past the grace period) are likely closed. Failed fetches change nothing.
  for (const c of companies) {
    if (!c.error && c.source) await deactivateMissingBoardJobs(c.source, c.slug, env.JOB_STALE_GRACE_DAYS);
  }

  // Invalidate cache on new ingest
  cachedJobs = null;
  cachedJobsExpiresAt = 0;

  return res.json({
    success: true,
    listingsSeen: listings.length,
    newListings,
    newMatches,
    companies,
  });
}

export async function getScanCompanies(req, res) {
  const user = await User.findById(req.user._id).select('scanCompanies');
  const saved = user?.scanCompanies;
  return res.json({ companies: saved && saved.length > 0 ? saved : DEFAULT_COMPANIES });
}

export async function updateScanCompanies(req, res) {
  const companies = cleanSlugs(req.body?.companies);
  await User.updateOne({ _id: req.user._id }, { $set: { scanCompanies: companies } });
  return res.json({ companies });
}

export async function listJobs(req, res) {
  const now = Date.now();
  if (cachedJobs && now < cachedJobsExpiresAt) {
    return res.json({ jobs: cachedJobs });
  }

  const jobs = await Job.find()
    .select('-description')
    .sort({ foundAt: -1 })
    .limit(100)
    .lean();

  cachedJobs = jobs;
  cachedJobsExpiresAt = now + 15000;

  return res.json({ jobs });
}

