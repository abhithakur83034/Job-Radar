import { env } from '../../config/env.js';
import { getSettings } from '../../config/runtimeSettings.js';
import { User } from '../../models/User.js';
import { Profile } from '../../models/Profile.js';
import { fetchAllBoardListings } from '../../utils/connectors.js';
import { companiesForUser } from '../../utils/companies.js';
import { upsertListings, scoreListingsForUser, deactivateMissingBoardJobs } from '../../utils/ingest.js';

const MAX_COMPANIES = 100;

/** Status/metadata entry for the employer-board step of the background refresh. */
export const employerBoardsSource = {
  id: 'boards',
  displayName: 'Your company boards',
  homepage: `${env.FRONTEND_ORIGIN.split(',')[0].trim()}/feed`,
  requiresKey: false,
  minIntervalMinutes: 60,
  isConfigured: () => true,
};

/**
 * Background refresh of every user's chosen employer boards (Greenhouse/Lever/Ashby):
 * picks up new openings, closes jobs a board no longer lists (after the grace period),
 * and scores each company's jobs only for the users who chose that company.
 */
export async function refreshEmployerBoards() {
  const userIds = await Profile.distinct('userId');
  const users = await User.find({ _id: { $in: userIds } }).select('scanCompanies').lean();
  const companiesByUser = users.map((u) => [u._id, companiesForUser(u)]);
  const slugs = [...new Set(companiesByUser.flatMap(([, companies]) => companies))].slice(0, MAX_COMPANIES);
  if (slugs.length === 0) return { fetched: 0, failedCompanies: [], newListings: 0, newMatches: 0, closed: 0 };

  const { listings, companies } = await fetchAllBoardListings(slugs);
  const { newListings, jobIdByKey } = await upsertListings(listings);

  // Only a successful fetch is a complete list for that company
  let closed = 0;
  for (const c of companies) {
    if (!c.error && c.source) closed += await deactivateMissingBoardJobs(c.source, c.slug, getSettings().staleGraceDays);
  }

  let newMatches = 0;
  for (const [userId, chosen] of companiesByUser) {
    const wanted = new Set(chosen);
    newMatches += await scoreListingsForUser(userId, listings.filter((l) => wanted.has(l.company)), jobIdByKey);
  }

  return {
    fetched: listings.length,
    failedCompanies: companies.filter((c) => c.error).map((c) => c.slug),
    newListings,
    newMatches,
    closed,
  };
}
