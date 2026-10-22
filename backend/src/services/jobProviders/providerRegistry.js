import { remotiveProvider } from './remotive.provider.js';
import { remoteOkProvider } from './remoteOk.provider.js';
import { jobicyProvider } from './jobicy.provider.js';
import { theMuseProvider } from './theMuse.provider.js';
import { adzunaProvider } from './adzuna.provider.js';
import { joobleProvider } from './jooble.provider.js';

/**
 * Background-refreshed job sources. Employer boards (Greenhouse/Lever/Ashby) are
 * per-company and run from the user's "Scan Job Portals" dialog (utils/connectors.js).
 *
 * Deferred after review (2026-10-22): USAJOBS (US federal roles only); Jobvetta (site
 * terms forbid republishing its data); LinkedIn / Indeed / Naukri (no authorized API;
 * their jobs arrive via the user's own alert emails — see controllers/gmail.controller.js).
 */
export const PROVIDERS = [
  remotiveProvider,
  remoteOkProvider,
  jobicyProvider,
  theMuseProvider,
  adzunaProvider,
  joobleProvider,
];

export function getProvider(id) {
  return PROVIDERS.find((p) => p.id === id) ?? null;
}

/** Display metadata for every known source, including the employer boards and email alerts. */
export const SOURCE_LABELS = {
  ...Object.fromEntries(PROVIDERS.map((p) => [p.id, p.displayName])),
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  linkedin: 'LinkedIn alert',
  naukri: 'Naukri alert',
  indeed: 'Indeed alert',
};
