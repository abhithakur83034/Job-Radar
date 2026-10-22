import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Job } from '../models/Job.js';

const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,62}$/;
const BOARD_SOURCES = ['greenhouse', 'lever', 'ashby'];
const MAX_COMPANIES = 50;

/** Normalize and validate company board slugs (lowercase, unique, max 50). */
export function cleanSlugs(input) {
  if (!Array.isArray(input)) return [];
  const slugs = input.map((s) => String(s).trim().toLowerCase()).filter((s) => SLUG_PATTERN.test(s));
  return [...new Set(slugs)].slice(0, MAX_COMPANIES);
}

/** Starting companies for users who haven't chosen any, from DEFAULT_SCAN_COMPANIES (optional). */
export function defaultScanCompanies() {
  return cleanSlugs((env.DEFAULT_SCAN_COMPANIES || '').split(','));
}

export function companiesForUser(user) {
  return user?.scanCompanies?.length ? user.scanCompanies : defaultScanCompanies();
}

/**
 * Company suggestions computed from live data: boards other users follow, and the
 * boards with the most open jobs already in the database.
 */
export async function suggestCompanies({ exclude = [], limit = 20 } = {}) {
  const [followed, busiest] = await Promise.all([
    User.aggregate([
      { $unwind: '$scanCompanies' },
      { $group: { _id: '$scanCompanies', followers: { $sum: 1 } } },
    ]),
    Job.aggregate([
      { $match: { source: { $in: BOARD_SOURCES }, isActive: { $ne: false } } },
      { $group: { _id: '$company', openJobs: { $sum: 1 }, source: { $first: '$source' } } },
      { $sort: { openJobs: -1 } },
      { $limit: 100 },
    ]),
  ]);

  const bySlug = new Map();
  for (const f of followed) bySlug.set(f._id, { slug: f._id, followers: f.followers, openJobs: 0 });
  for (const b of busiest) {
    const entry = bySlug.get(b._id) ?? { slug: b._id, followers: 0, openJobs: 0 };
    bySlug.set(b._id, { ...entry, openJobs: b.openJobs, source: b.source });
  }

  const skip = new Set(exclude);
  return [...bySlug.values()]
    .filter((c) => !skip.has(c.slug) && SLUG_PATTERN.test(c.slug))
    .sort((a, b) => b.followers - a.followers || b.openJobs - a.openJobs)
    .slice(0, limit);
}
