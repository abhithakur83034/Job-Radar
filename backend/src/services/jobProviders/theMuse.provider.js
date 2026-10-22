import { env } from '../../config/env.js';
import { fetchJson, FetchError } from '../../utils/safeFetch.js';

const PAGES = 3; // 20 jobs per page

/**
 * The Muse public jobs API. Works without a key (500 req/hour); a free registered key
 * (THE_MUSE_API_KEY) raises that to 3600/hour and is required beyond testing.
 * Terms (verified 2026-10-22): content must link back to The Muse; don't use its
 * name/logo to imply partnership; delete stored content if access ends.
 * Its location filter ignores India, so this fetches remote ("Flexible / Remote") roles.
 */
export const theMuseProvider = {
  id: 'themuse',
  displayName: 'The Muse',
  homepage: 'https://www.themuse.com',
  terms: 'https://www.themuse.com/developers/api/v2/terms (verified 2026-10-22)',
  requiresKey: false,
  minIntervalMinutes: 60,
  usesQueries: false,
  isConfigured: () => true,

  async fetchJobs() {
    const jobs = [];
    for (let page = 0; page < PAGES; page++) {
      const params = new URLSearchParams({ page: String(page), location: 'Flexible / Remote', descending: 'true' });
      if (env.THE_MUSE_API_KEY) params.set('api_key', env.THE_MUSE_API_KEY);

      const data = await fetchJson(`https://www.themuse.com/api/public/jobs?${params}`);
      if (!Array.isArray(data?.results)) throw new FetchError('BAD_RESPONSE', 'The Muse response has no results array');
      jobs.push(...data.results);
      if (page + 1 >= (data.page_count ?? 0)) break;
    }

    return jobs.map((job) => {
      const locations = (job.locations || []).map((l) => l?.name).filter(Boolean);
      return {
        externalId: job.id,
        title: job.name,
        company: job.company?.name,
        location: locations.join(' / ') || 'Unspecified',
        descriptionHtml: job.contents,
        url: job.refs?.landing_page,
        postedAt: job.publication_date,
        employmentType: (job.levels || []).map((l) => l?.name).filter(Boolean).join(', '),
        remoteType: locations.some((l) => /remote|flexible/i.test(l)) ? 'remote' : undefined,
      };
    });
  },
};
