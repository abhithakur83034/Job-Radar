import { env } from '../../config/env.js';
import { getSettings } from '../../config/runtimeSettings.js';
import { runJobRefresh } from './jobRefresh.service.js';

const FIRST_RUN_DELAY_MS = 60 * 1000;
// While refresh is switched off, re-check the setting this often (admins can enable it at runtime)
const DISABLED_RECHECK_MS = 5 * 60 * 1000;
let timer = null;
let stopped = true;

async function tick() {
  if (stopped) return;
  const settings = getSettings();
  if (settings.refreshEnabled) {
    try {
      const result = await runJobRefresh({ trigger: 'scheduler' });
      if (result.status === 'completed') {
        const summary = result.providers.map((p) => `${p.id}=${p.status}${p.fetched !== undefined ? `(${p.fetched})` : ''}`);
        console.log(
          `[JobRefresh] ${result.outcome}: ${summary.join(' ')} | new listings ${result.newListings}, new matches ${result.newMatches}, ${result.durationMs}ms`
        );
      }
    } catch (err) {
      console.error('[JobRefresh] Run failed:', err.message);
    }
  }
  schedule(settings.refreshEnabled ? getSettings().refreshIntervalMinutes * 60 * 1000 : DISABLED_RECHECK_MS);
}

function schedule(delayMs) {
  if (stopped) return;
  timer = setTimeout(tick, delayMs);
  timer.unref();
}

/**
 * Background refresh loop. Never runs in tests. Whether it fetches, and how often,
 * comes from runtime settings (env defaults, overridable in Admin → Settings), read
 * before every tick so changes apply without a restart.
 */
export function startJobScheduler() {
  if (env.NODE_ENV === 'test' || !stopped) return false;
  stopped = false;
  schedule(FIRST_RUN_DELAY_MS);
  const s = getSettings();
  console.log(
    `[JobRefresh] Scheduler started: ${s.refreshEnabled ? `every ${s.refreshIntervalMinutes} min (first run in 60s)` : 'refresh currently disabled'}`
  );
  return true;
}

export function stopJobScheduler() {
  stopped = true;
  if (timer) clearTimeout(timer);
  timer = null;
}
