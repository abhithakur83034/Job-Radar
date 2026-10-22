import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { env } from '../src/config/env.js';
import { fetchJson, FetchError } from '../src/utils/safeFetch.js';
import { normalizeListing, detectRemoteType } from '../src/services/jobs/jobNormalize.service.js';
import { remotiveProvider } from '../src/services/jobProviders/remotive.provider.js';
import { remoteOkProvider } from '../src/services/jobProviders/remoteOk.provider.js';
import { jobicyProvider } from '../src/services/jobProviders/jobicy.provider.js';
import { theMuseProvider } from '../src/services/jobProviders/theMuse.provider.js';
import { adzunaProvider } from '../src/services/jobProviders/adzuna.provider.js';
import { joobleProvider } from '../src/services/jobProviders/jooble.provider.js';

// --- Fixtures: trimmed copies of real responses (verified 2026-10-22) ---
const FIXTURES = {
  remotive: {
    'job-count': 1,
    jobs: [{
      id: 2087301, url: 'https://remotive.com/remote-jobs/software-dev/senior-react-engineer-2087301',
      title: 'Senior React Engineer', company_name: 'Acme', job_type: 'full_time',
      publication_date: '2026-10-20T09:12:00', candidate_required_location: 'Worldwide',
      salary: '$80k - $100k', description: '<p>Build <b>React</b> apps.</p><script>alert(1)</script>',
    }],
  },
  remoteok: [
    { last_updated: 1792540000, legal: 'Please link back to Remote OK...' },
    {
      id: '1129001', position: 'Backend Engineer', company: 'DuckDuckGo', location: '',
      salary_min: 150000, salary_max: 190000, url: 'https://remoteok.com/remote-jobs/remote-backend-engineer-1129001',
      date: '2026-10-21T10:00:00+00:00', description: '<p>Go &amp; Postgres</p>',
    },
  ],
  jobicy: {
    jobs: [{
      id: 156402, url: 'https://jobicy.com/jobs/156402-growth-product-manager-2', jobTitle: 'Growth Product Manager',
      companyName: 'YipitData', jobType: ['Full-Time'], jobGeo: 'APAC', salaryMin: 120000, salaryMax: 150000,
      salaryCurrency: 'USD', pubDate: '2026-10-22 04:10:00', jobDescription: '<p>Own growth</p>',
    }],
  },
  themuse: {
    page: 0, page_count: 1,
    results: [{
      id: 1660251, name: '  Principal Product Manager ', company: { name: 'Atlassian' },
      locations: [{ name: 'Bangalore, India' }, { name: 'Flexible / Remote' }], levels: [{ name: 'Senior Level' }],
      refs: { landing_page: 'https://www.themuse.com/jobs/atlassian/principal-product-manager' },
      publication_date: '2026-10-03T00:00:00Z', contents: '<p>Lead products</p>',
    }],
  },
  adzuna: {
    results: [{
      id: '4910277361', title: 'Frontend Developer', company: { display_name: 'Initech' },
      location: { display_name: 'Pune, Maharashtra' }, salary_min: 800000, salary_max: 1400000,
      salary_is_predicted: '0', redirect_url: 'https://www.adzuna.in/land/ad/4910277361', created: '2026-10-19T08:00:00Z',
      description: 'React and TypeScript…', contract_time: 'full_time',
    }],
  },
  jooble: {
    totalCount: 1,
    jobs: [{
      id: -556677889, title: 'Node.js Developer', company: 'Hooli', location: 'Noida',
      salary: '₹8L - ₹12L', link: 'https://in.jooble.org/desc/-556677889', updated: '2026-10-20T00:00:00', snippet: 'Node &amp; Mongo',
    }],
  },
};

const PROVIDERS = [
  { provider: remotiveProvider, fixture: FIXTURES.remotive, empty: { jobs: [] }, malformed: { jobs: 'nope' } },
  { provider: remoteOkProvider, fixture: FIXTURES.remoteok, empty: [FIXTURES.remoteok[0]], malformed: { error: 'x' } },
  { provider: jobicyProvider, fixture: FIXTURES.jobicy, empty: { jobs: [] }, malformed: { success: false } },
  { provider: theMuseProvider, fixture: FIXTURES.themuse, empty: { page: 0, page_count: 0, results: [] }, malformed: { results: null } },
  { provider: adzunaProvider, fixture: FIXTURES.adzuna, empty: { results: [] }, malformed: { exception: 'AUTH_FAIL' } },
  { provider: joobleProvider, fixture: FIXTURES.jooble, empty: { jobs: [] }, malformed: { totalCount: 0 } },
];

const QUERIES = [{ keywords: 'frontend developer', location: 'Pune' }];

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

const saved = {};
beforeEach(() => {
  for (const k of ['JOB_FETCH_MAX_RETRIES', 'ADZUNA_APP_ID', 'ADZUNA_APP_KEY', 'JOOBLE_API_KEY']) saved[k] = env[k];
  Object.assign(env, { JOB_FETCH_MAX_RETRIES: 0, ADZUNA_APP_ID: 'test-id', ADZUNA_APP_KEY: 'test-key', JOOBLE_API_KEY: 'test-key' });
});
afterEach(() => {
  Object.assign(env, saved);
  vi.unstubAllGlobals();
});

describe.each(PROVIDERS)('$provider.displayName provider', ({ provider, fixture, empty, malformed }) => {
  it('maps valid data to normalizable listings with the source link', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(fixture)));
    const raw = await provider.fetchJobs({ queries: QUERIES });
    const listings = raw.map((r) => normalizeListing(r, provider.id));

    expect(listings.length).toBeGreaterThan(0);
    for (const l of listings) {
      expect(l).not.toBeNull();
      expect(l.source).toBe(provider.id);
      expect(l.title).toBeTruthy();
      expect(l.url).toMatch(/^https:\/\//);
      expect(l.description).not.toMatch(/<[a-z]|alert\(1\)/i);
    }
  });

  it('returns an empty list for an empty response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(empty)));
    expect(await provider.fetchJobs({ queries: QUERIES })).toEqual([]);
  });

  it('rejects a malformed response with BAD_RESPONSE', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(malformed)));
    await expect(provider.fetchJobs({ queries: QUERIES })).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  it('surfaces non-2xx, rate limiting and timeouts as typed errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'boom' }, 503)));
    await expect(provider.fetchJobs({ queries: QUERIES })).rejects.toMatchObject({ code: 'HTTP_503' });

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, 429, { 'retry-after': '60' })));
    await expect(provider.fetchJobs({ queries: QUERIES })).rejects.toMatchObject({ code: 'RATE_LIMITED' });

    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('timed out', 'TimeoutError'); }));
    await expect(provider.fetchJobs({ queries: QUERIES })).rejects.toMatchObject({ code: 'TIMEOUT' });
  });
});

describe('provider specifics', () => {
  it('Remote OK skips its legal-notice element', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(FIXTURES.remoteok)));
    const raw = await remoteOkProvider.fetchJobs();
    expect(raw).toHaveLength(1);
    expect(normalizeListing(raw[0], 'remoteok')).toMatchObject({ location: 'Remote', salaryText: 'USD 150k–190k' });
  });

  it('keyed providers are disabled until their credentials are set', () => {
    Object.assign(env, { ADZUNA_APP_ID: undefined, JOOBLE_API_KEY: undefined });
    expect(adzunaProvider.isConfigured()).toBe(false);
    expect(joobleProvider.isConfigured()).toBe(false);
  });

  it('keeps API keys out of returned listings', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(FIXTURES.adzuna)));
    const raw = await adzunaProvider.fetchJobs({ queries: QUERIES });
    expect(JSON.stringify(raw)).not.toContain('test-key');
  });

  it('Adzuna sends the query and country; Jooble POSTs JSON without retries', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(FIXTURES.adzuna));
    vi.stubGlobal('fetch', fetchMock);
    await adzunaProvider.fetchJobs({ queries: QUERIES });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe('/v1/api/jobs/in/search/1');
    expect(url.searchParams.get('what')).toBe('frontend developer');
    expect(url.searchParams.get('where')).toBe('Pune');

    Object.assign(env, { JOB_FETCH_MAX_RETRIES: 2 });
    const joobleFetch = vi.fn(async () => jsonResponse({}, 503));
    vi.stubGlobal('fetch', joobleFetch);
    await expect(joobleProvider.fetchJobs({ queries: QUERIES })).rejects.toMatchObject({ code: 'HTTP_503' });
    expect(joobleFetch).toHaveBeenCalledTimes(1); // each call counts against Jooble's lifetime cap
    expect(joobleFetch.mock.calls[0][1]).toMatchObject({ method: 'POST' });
  });

  it('Adzuna ignores predicted (estimated) salaries', async () => {
    const predicted = { results: [{ ...FIXTURES.adzuna.results[0], salary_is_predicted: '1' }] };
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(predicted)));
    const [raw] = await adzunaProvider.fetchJobs({ queries: QUERIES });
    expect(normalizeListing(raw, 'adzuna').salaryText).toBeNull();
  });
});

describe('fetchJson', () => {
  it('retries transient failures with backoff, then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 502))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchJson('https://example.com', { retries: 2, baseDelayMs: 1 })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry permanent failures', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 404));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchJson('https://example.com', { retries: 3, baseDelayMs: 1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('enforces a response size limit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x'.repeat(5000))));
    await expect(fetchJson('https://example.com', { maxBytes: 1000 })).rejects.toMatchObject({ code: 'TOO_LARGE' });
  });

  it('reports invalid JSON as BAD_RESPONSE', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>blocked</html>')));
    const err = await fetchJson('https://example.com').catch((e) => e);
    expect(err).toBeInstanceOf(FetchError);
    expect(err.code).toBe('BAD_RESPONSE');
  });
});

describe('normalizeListing', () => {
  const base = { externalId: 1, title: 'Engineer', url: 'https://example.com/job/1' };

  it('rejects listings without an id, title, or a safe http(s) URL', () => {
    expect(normalizeListing({ ...base, externalId: '' }, 's')).toBeNull();
    expect(normalizeListing({ ...base, title: '   ' }, 's')).toBeNull();
    expect(normalizeListing({ ...base, url: 'javascript:alert(1)' }, 's')).toBeNull();
    expect(normalizeListing({ ...base, url: 'not a url' }, 's')).toBeNull();
    expect(normalizeListing(null, 's')).toBeNull();
  });

  it('fills safe defaults and caps field sizes', () => {
    const l = normalizeListing({ ...base, title: 'x'.repeat(1000), descriptionHtml: `<p>${'y'.repeat(30000)}</p>` }, 's');
    expect(l.title).toHaveLength(300);
    expect(l.description.length).toBeLessThanOrEqual(20000);
    expect(l).toMatchObject({ company: 'Unknown company', location: 'Unspecified', externalId: '1' });
  });

  it('parses dates in ISO, unix seconds and milliseconds; drops invalid ones', () => {
    expect(normalizeListing({ ...base, postedAt: '2026-10-20T00:00:00Z' }, 's').postedAt.toISOString()).toBe('2026-10-20T00:00:00.000Z');
    expect(normalizeListing({ ...base, postedAt: 1792540800 }, 's').postedAt.getUTCFullYear()).toBe(2026);
    expect(normalizeListing({ ...base, postedAt: 1792540800000 }, 's').postedAt.getUTCFullYear()).toBe(2026);
    expect(normalizeListing({ ...base, postedAt: 'garbage' }, 's').postedAt).toBeNull();
  });

  it('detects remote / hybrid / onsite from location text', () => {
    expect(detectRemoteType('Remote - India')).toBe('remote');
    expect(detectRemoteType('Bengaluru (Hybrid)')).toBe('hybrid');
    expect(detectRemoteType('Pune', 'On-site')).toBe('onsite');
    expect(detectRemoteType('Pune')).toBe('unknown');
  });
});
