import { getSourceStatuses } from '../services/jobs/jobRefresh.service.js';
import { SOURCE_LABELS, PROVIDERS } from '../services/jobProviders/providerRegistry.js';

/** GET /api/v1/job-sources/public: names and links of enabled sources (credits for the About page). */
export function listPublicSources(_req, res) {
  res.set('Cache-Control', 'public, max-age=300');
  return res.json({
    sources: PROVIDERS.filter((p) => p.isConfigured()).map((p) => ({ id: p.id, name: p.displayName, homepage: p.homepage })),
  });
}

/** GET /api/v1/job-sources: which background sources are enabled and how fresh they are. */
export async function listJobSources(_req, res) {
  const sources = await getSourceStatuses();
  // Error details are admin-only
  // labels: display names for every source id a job can have (incl. boards and email alerts)
  return res.json({ sources: sources.map(({ lastError: _e, ...source }) => source), labels: SOURCE_LABELS });
}
