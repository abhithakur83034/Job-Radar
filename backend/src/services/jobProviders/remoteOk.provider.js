import { fetchJson, FetchError } from '../../utils/safeFetch.js';

/**
 * Remote OK public API. Terms (first element of the API response, verified 2026-10-22):
 * link back to the Remote OK URL (followed, not nofollow) and name "Remote OK" as the
 * source; don't use the Remote OK logo.
 */
export const remoteOkProvider = {
  id: 'remoteok',
  displayName: 'Remote OK',
  homepage: 'https://remoteok.com',
  terms: 'https://remoteok.com/api legal notice (verified 2026-10-22)',
  requiresKey: false,
  minIntervalMinutes: 120,
  usesQueries: false,
  isConfigured: () => true,

  async fetchJobs() {
    const data = await fetchJson('https://remoteok.com/api', { maxBytes: 15 * 1024 * 1024 });
    if (!Array.isArray(data)) throw new FetchError('BAD_RESPONSE', 'Remote OK response is not an array');

    // Element 0 is the legal notice, not a job
    return data
      .filter((item) => item && item.id && item.position)
      .map((job) => ({
        externalId: job.id,
        title: job.position,
        company: job.company,
        location: job.location || 'Remote',
        descriptionHtml: job.description,
        salaryMin: job.salary_min,
        salaryMax: job.salary_max,
        salaryCurrency: job.salary_min || job.salary_max ? 'USD' : null,
        url: job.url,
        postedAt: job.date || job.epoch,
        remoteType: 'remote',
      }));
  },
};
