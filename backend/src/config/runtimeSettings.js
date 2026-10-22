import Joi from 'joi';
import { env } from './env.js';
import { AppSetting } from '../models/AppSetting.js';

/**
 * Job-refresh settings admins can change at runtime (Admin → Settings). Environment
 * variables provide the defaults; saved values override them and take effect on the
 * next refresh tick without a redeploy.
 */
export const settingsSchema = Joi.object({
  refreshEnabled: Joi.boolean(),
  refreshIntervalMinutes: Joi.number().integer().min(15).max(24 * 60),
  fetchConcurrency: Joi.number().integer().min(1).max(10),
  fetchTimeoutMs: Joi.number().integer().min(1000).max(60000),
  staleGraceDays: Joi.number().integer().min(1).max(60),
  listingMaxAgeDays: Joi.number().integer().min(7).max(180),
}).min(1);

const SETTINGS_KEY = 'jobRefreshSettings';

function envDefaults() {
  return {
    refreshEnabled: env.JOB_REFRESH_ENABLED,
    refreshIntervalMinutes: env.JOB_REFRESH_INTERVAL_MINUTES,
    fetchConcurrency: env.JOB_FETCH_CONCURRENCY,
    fetchTimeoutMs: env.JOB_FETCH_TIMEOUT_MS,
    staleGraceDays: env.JOB_STALE_GRACE_DAYS,
    listingMaxAgeDays: env.JOB_LISTING_MAX_AGE_DAYS,
  };
}

// In-memory effective settings (read synchronously by fetch/refresh code)
let current = envDefaults();
let overrides = {};

export function getSettings() {
  return current;
}

export function getSettingsDetail() {
  return { effective: current, defaults: envDefaults(), overrides };
}

/** Load saved overrides from the database (call once after connecting). */
export async function loadSettings() {
  const saved = await AppSetting.findById(SETTINGS_KEY).lean();
  overrides = saved?.value && typeof saved.value === 'object' ? saved.value : {};
  // Ignore anything that no longer validates (e.g. limits changed since it was saved)
  const { value, error } = settingsSchema.validate(overrides, { stripUnknown: true });
  if (error) overrides = {};
  else overrides = value ?? {};
  current = { ...envDefaults(), ...overrides };
  return current;
}

/** Validate, persist and apply new overrides; returns { before, after }. */
export async function updateSettings(changes) {
  const { value, error } = settingsSchema.validate(changes, { stripUnknown: true, abortEarly: false });
  if (error) throw error;
  const before = current;
  overrides = { ...overrides, ...value };
  await AppSetting.updateOne({ _id: SETTINGS_KEY }, { value: overrides }, { upsert: true });
  current = { ...envDefaults(), ...overrides };
  return { before, after: current };
}

/** Drop all overrides and return to the environment defaults. */
export async function resetSettings() {
  const before = current;
  overrides = {};
  await AppSetting.deleteOne({ _id: SETTINGS_KEY });
  current = envDefaults();
  return { before, after: current };
}
