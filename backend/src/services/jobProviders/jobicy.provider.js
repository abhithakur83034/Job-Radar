import { fetchJson, FetchError } from '../../utils/safeFetch.js';

/**
 * Jobicy remote-jobs API (https://jobicy.com/api/jobs). Terms (verified 2026-10-22):
 * credit Jobicy with a direct link and keep the canonical Jobicy job URL for applying;
 * at most one automated pass per hour. Only the last 7 days of jobs are returned.
 */
export const jobicyProvider = {
  id: 'jobicy',
  displayName: 'Jobicy',
  homepage: 'https://jobicy.com',
  terms: 'https://jobicy.com/jobs-rss-feed (verified 2026-10-22)',
  requiresKey: false,
  minIntervalMinutes: 60,
  usesQueries: false,
  isConfigured: () => true,

  async fetchJobs() {
    const data = await fetchJson('https://jobicy.com/api/jobs?count=100', { maxBytes: 15 * 1024 * 1024 });
    if (!Array.isArray(data?.jobs)) throw new FetchError('BAD_RESPONSE', 'Jobicy response has no jobs array');

    return data.jobs.map((job) => ({
      externalId: job.id,
      title: job.jobTitle,
      company: job.companyName,
      location: job.jobGeo || 'Remote',
      descriptionHtml: job.jobDescription || job.jobExcerpt,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryCurrency: job.salaryCurrency,
      url: job.url,
      postedAt: job.pubDate,
      employmentType: Array.isArray(job.jobType) ? job.jobType.join(', ') : job.jobType,
      remoteType: 'remote',
    }));
  },
};
