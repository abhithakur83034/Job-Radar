import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { fetchAllBoardListings } from '../utils/connectors.js';
import { ingestListings } from '../utils/ingest.js';

const DEFAULT_COMPANIES = ['gitlab', 'reddit', 'affirm', 'brex', 'canonical', 'datadog'];
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,62}$/;

function cleanSlugs(input) {
  if (!Array.isArray(input)) return [];
  const slugs = input.map((s) => String(s).trim().toLowerCase()).filter((s) => SLUG_PATTERN.test(s));
  return [...new Set(slugs)].slice(0, 50);
}

export async function syncListings(req, res) {
  const requested = cleanSlugs(req.body?.boardTokens);
  const tokens = requested.length > 0 ? requested : DEFAULT_COMPANIES;

  const { listings, companies } = await fetchAllBoardListings(tokens);
  const { newListings, newMatches } = await ingestListings(req.user._id, listings);

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
  const jobs = await Job.find().sort({ foundAt: -1 }).limit(100);
  return res.json({ jobs });
}

