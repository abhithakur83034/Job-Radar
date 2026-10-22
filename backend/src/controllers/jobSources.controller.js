import { getSourceStatuses, runJobRefresh } from '../services/jobs/jobRefresh.service.js';

/** GET /api/v1/job-sources: which background sources are enabled and how fresh they are. */
export async function listJobSources(_req, res) {
  const sources = await getSourceStatuses();
  // Error details are admin-only
  return res.json({ sources: sources.map(({ lastError: _e, ...source }) => source) });
}

/** GET /api/v1/admin/job-sources/status */
export async function adminJobSourceStatus(_req, res) {
  return res.json({ sources: await getSourceStatuses() });
}

/** POST /api/v1/admin/job-sources/refresh: run due sources now (rate limits still apply). */
export async function adminRefreshJobSources(_req, res) {
  const result = await runJobRefresh({ trigger: 'admin' });
  if (result.status === 'locked') {
    return res.status(409).json({ error: result.message });
  }
  return res.json(result);
}
