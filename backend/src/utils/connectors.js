import { stripHtml } from './html.js';
import { fetchJson, FetchError } from './safeFetch.js';

// Employer job boards (Greenhouse, Lever, Ashby): public, employer-published postings.
// A board fetch returns that company's complete current list of openings.

async function getJson(url) {
  return fetchJson(url, { timeoutMs: 30000, maxBytes: 25 * 1024 * 1024 });
}

export async function fetchGreenhouseListings(boardToken) {
  const data = await getJson(`https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`);
  const jobs = data.jobs || [];

  return jobs.map((job) => ({
    source: 'greenhouse',
    externalId: String(job.id),
    title: job.title,
    company: boardToken,
    location: job.location?.name ?? 'Unspecified',
    description: job.content ? stripHtml(job.content) : '',
    salaryText: null,
    url: job.absolute_url,
  }));
}

export async function fetchLeverListings(company) {
  const jobs = await getJson(`https://api.lever.co/v0/postings/${company}?mode=json`);
  if (!Array.isArray(jobs)) return [];

  return jobs.map((job) => ({
    source: 'lever',
    externalId: String(job.id),
    title: job.text,
    company,
    location: job.categories?.location || 'Unspecified',
    description: job.descriptionPlain || stripHtml(job.description || ''),
    salaryText: job.salaryDescription || null,
    url: job.hostedUrl || job.applyUrl,
  }));
}

export async function fetchAshbyListings(company) {
  const data = await getJson(
    `https://api.ashbyhq.com/posting-api/job-board/${company}?includeCompensation=true`
  );
  const jobs = (data.jobs || []).filter((job) => job.isListed !== false);

  return jobs.map((job) => ({
    source: 'ashby',
    externalId: String(job.id),
    title: job.title,
    company,
    location: job.location || (job.isRemote ? 'Remote' : 'Unspecified'),
    description: job.descriptionPlain || stripHtml(job.descriptionHtml || ''),
    salaryText: job.compensation?.compensationTierSummary || null,
    url: job.jobUrl,
  }));
}

// Tried in order; a company slug is looked up on each ATS until one knows it.
const PROVIDERS = [
  ['greenhouse', fetchGreenhouseListings],
  ['lever', fetchLeverListings],
  ['ashby', fetchAshbyListings],
];

async function fetchCompanyListings(slug) {
  for (const [source, fetchListings] of PROVIDERS) {
    try {
      const listings = await fetchListings(slug);
      return { slug, source, count: listings.length, listings };
    } catch (err) {
      if (!(err instanceof FetchError && err.code === 'NOT_FOUND')) {
        return { slug, source, count: 0, listings: [], error: err.message };
      }
    }
  }
  return { slug, source: null, count: 0, listings: [], error: 'Not found on Greenhouse, Lever or Ashby' };
}

/**
 * Fetch all companies in parallel. Returns every listing plus a per-company
 * summary so callers can report which slugs failed.
 */
export async function fetchAllBoardListings(boardTokens = []) {
  const results = await Promise.all(boardTokens.map(fetchCompanyListings));
  return {
    listings: results.flatMap((r) => r.listings),
    companies: results.map(({ listings, ...summary }) => summary),
  };
}
