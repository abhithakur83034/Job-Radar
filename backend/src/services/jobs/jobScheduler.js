import { env } from '../../config/env.js';
import { runJobRefresh } from './jobRefresh.service.js';

const FIRST_RUN_DELAY_MS = 60 * 1000;
let timers = [];

async function tick() {
  try {
    const result = await runJobRefresh({ trigger: 'scheduler' });
    if (result.status === 'completed') {
      const summary = result.providers.map((p) => `${p.id}=${p.status}${p.fetched !== undefined ? `(${p.fetched})` : ''}`);
      console.log(
        `[JobRefresh] ${summary.join(' ')} | new listings ${result.newListings}, new matches ${result.newMatches}, ${result.durationMs}ms`
      );
    }
  } catch (err) {
    console.error('[JobRefresh] Run failed:', err.message);
  }
}

/**
 * Background refresh of job sources. Off unless JOB_REFRESH_ENABLED=true, and never
 * in tests. The feed always reads from MongoDB; this only keeps it fresh.
 */
export function startJobScheduler() {
  if (!env.JOB_REFRESH_ENABLED || env.NODE_ENV === 'test') return false;

  const intervalMs = env.JOB_REFRESH_INTERVAL_MINUTES * 60 * 1000;
  timers = [setTimeout(tick, FIRST_RUN_DELAY_MS), setInterval(tick, intervalMs)];
  timers.forEach((t) => t.unref());
  console.log(`[JobRefresh] Scheduler on: every ${env.JOB_REFRESH_INTERVAL_MINUTES} min (first run in 60s)`);
  return true;
}

export function stopJobScheduler() {
  timers.forEach((t) => clearTimeout(t));
  timers = [];
}
