import { fetchJson, FetchError } from '../../utils/safeFetch.js';

/**
 * Remotive public remote-jobs API. Terms (in the API response, verified 2026-10-22):
 * link back to the Remotive URL and name Remotive as the source; max ~4 requests/day;
 * listings are delayed 24h; don't resubmit jobs to other job boards.
 */
export const remotiveProvider = {
  id: 'remotive',
  displayName: 'Remotive',
  homepage: 'https://remotive.com',
  terms: 'https://remotive.com/remote-jobs/api (verified 2026-10-22)',
  requiresKey: false,
  minIntervalMinutes: 360,
  usesQueries: false,
  isConfigured: () => true,

  async fetchJobs() {
    const data = await fetchJson('https://remotive.com/api/remote-jobs', { maxBytes: 15 * 1024 * 1024 });
    if (!Array.isArray(data?.jobs)) throw new FetchError('BAD_RESPONSE', 'Remotive response has no jobs array');

    return data.jobs.map((job) => ({
      externalId: job.id,
      title: job.title,
      company: job.company_name,
      location: job.candidate_required_location || 'Remote',
      descriptionHtml: job.description,
      salaryText: job.salary,
      url: job.url,
      postedAt: job.publication_date,
      employmentType: job.job_type,
      remoteType: 'remote',
    }));
  },
};
