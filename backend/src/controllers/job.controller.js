import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { fetchAllBoardListings } from '../utils/connectors.js';
import { ingestListings, deactivateMissingBoardJobs } from '../utils/ingest.js';
import { cleanSlugs, companiesForUser, suggestCompanies } from '../utils/companies.js';
import { SOURCE_LABELS } from '../services/jobProviders/providerRegistry.js';
import { getSettings } from '../config/runtimeSettings.js';

let cachedJobs = null;
let cachedJobsExpiresAt = 0;

export async function syncListings(req, res) {
  const requested = cleanSlugs(req.body?.boardTokens);
  const tokens = requested.length > 0 ? requested : companiesForUser(await User.findById(req.user._id).select('scanCompanies'));
  if (tokens.length === 0) {
    return res.status(400).json({ error: 'Add at least one company to scan.' });
  }

  const { listings, companies } = await fetchAllBoardListings(tokens);
  const { newListings, newMatches } = await ingestListings(req.user._id, listings);

  // A successful board fetch is that company's complete list, so jobs it no longer
  // lists (past the grace period) are likely closed. Failed fetches change nothing.
  for (const c of companies) {
    if (!c.error && c.source) await deactivateMissingBoardJobs(c.source, c.slug, getSettings().staleGraceDays);
  }

  // Invalidate cache on new ingest
  cachedJobs = null;
  cachedJobsExpiresAt = 0;

  return res.json({
    success: true,
    listingsSeen: listings.length,
    newListings,
    newMatches,
    companies: companies.map((c) => ({ ...c, sourceLabel: c.source ? SOURCE_LABELS[c.source] ?? c.source : null })),
  });
}

/** The user's companies plus live suggestions (followed by others / most open jobs). */
export async function getScanCompanies(req, res) {
  const user = await User.findById(req.user._id).select('scanCompanies');
  const companies = companiesForUser(user);
  const suggestions = await suggestCompanies({ exclude: companies });
  return res.json({ companies, suggestions });
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

