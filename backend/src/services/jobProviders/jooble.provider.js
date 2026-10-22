import { env } from '../../config/env.js';
import { fetchJson, FetchError } from '../../utils/safeFetch.js';

// Jooble's free plan is a 500-request LIFETIME cap per key, so stay frugal:
// at most 3 queries, once a day (~165 days of use per key).
const MAX_QUERIES = 3;

/**
 * Jooble job-search API. Needs JOOBLE_API_KEY (request one at https://in.jooble.org/api/about);
 * each country domain issues its own key, so JOOBLE_HOST defaults to in.jooble.org.
 * Disabled until configured. India terms/coverage unconfirmed (2026-10-22): verify with a key.
 */
export const joobleProvider = {
  id: 'jooble',
  displayName: 'Jooble',
  homepage: 'https://in.jooble.org',
  terms: 'https://jooble.org/api/about (verified 2026-10-22; India terms page not reachable)',
  requiresKey: true,
  minIntervalMinutes: 24 * 60,
  usesQueries: true,
  isConfigured: () => Boolean(env.JOOBLE_API_KEY),

  async fetchJobs({ queries = [] } = {}) {
    const jobs = [];
    for (const query of queries.slice(0, MAX_QUERIES)) {
      const data = await fetchJson(`https://${env.JOOBLE_HOST}/api/${encodeURIComponent(env.JOOBLE_API_KEY)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: query.keywords, location: query.location || '', page: 1, ResultOnPage: 50 }),
        retries: 0, // every request counts against the lifetime cap
      });
      if (!Array.isArray(data?.jobs)) throw new FetchError('BAD_RESPONSE', 'Jooble response has no jobs array');
      jobs.push(...data.jobs);
    }

    return jobs.map((job) => ({
      externalId: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      descriptionHtml: job.snippet,
      salaryText: job.salary,
      url: job.link,
      postedAt: job.updated,
      employmentType: job.type,
    }));
  },
};
