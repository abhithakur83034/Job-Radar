import { env } from '../../config/env.js';
import { fetchJson, FetchError } from '../../utils/safeFetch.js';

const MAX_QUERIES = 5;

/**
 * Adzuna job-search API (aggregates many boards; country via ADZUNA_COUNTRY, default "in").
 * Needs ADZUNA_APP_ID + ADZUNA_APP_KEY from https://developer.adzuna.com — disabled until set.
 * Terms (verified 2026-10-22): label each listing "Adzuna" and link to the Adzuna page;
 * "personal job search" use is permitted; quotas are shown in the Adzuna dashboard.
 * India coverage is likely but unconfirmed in Adzuna's docs: check with a real key.
 */
export const adzunaProvider = {
  id: 'adzuna',
  displayName: 'Adzuna',
  homepage: 'https://www.adzuna.in',
  terms: 'https://developer.adzuna.com/docs/terms_of_service (verified 2026-10-22)',
  requiresKey: true,
  minIntervalMinutes: 360,
  usesQueries: true,
  isConfigured: () => Boolean(env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY),

  async fetchJobs({ queries = [] } = {}) {
    const jobs = [];
    for (const query of queries.slice(0, MAX_QUERIES)) {
      const params = new URLSearchParams({
        app_id: env.ADZUNA_APP_ID,
        app_key: env.ADZUNA_APP_KEY,
        results_per_page: '50',
        what: query.keywords,
        max_days_old: '30',
        sort_by: 'date',
        'content-type': 'application/json',
      });
      if (query.location) params.set('where', query.location);

      const data = await fetchJson(`https://api.adzuna.com/v1/api/jobs/${env.ADZUNA_COUNTRY}/search/1?${params}`);
      if (!Array.isArray(data?.results)) throw new FetchError('BAD_RESPONSE', 'Adzuna response has no results array');
      jobs.push(...data.results);
    }

    return jobs.map((job) => ({
      externalId: job.id,
      title: job.title,
      company: job.company?.display_name,
      location: job.location?.display_name,
      descriptionHtml: job.description,
      // Adzuna may estimate salaries; only show ones the employer actually stated
      salaryMin: job.salary_is_predicted === '1' ? null : job.salary_min,
      salaryMax: job.salary_is_predicted === '1' ? null : job.salary_max,
      salaryCurrency: env.ADZUNA_COUNTRY === 'in' ? 'INR' : null,
      url: job.redirect_url,
      postedAt: job.created,
      employmentType: [job.contract_time, job.contract_type].filter(Boolean).join(', '),
    }));
  },
};
