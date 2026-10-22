import { stripHtml } from '../../utils/html.js';

const LIMITS = { title: 300, company: 200, location: 200, description: 20000, salaryText: 120, employmentType: 60 };

function clean(value, max) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function safeUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  // Unix seconds vs milliseconds
  const date = typeof value === 'number' ? new Date(value < 1e12 ? value * 1000 : value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toPositiveNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function detectRemoteType(...texts) {
  const text = texts.filter(Boolean).join(' ').toLowerCase();
  if (/\bhybrid\b/.test(text)) return 'hybrid';
  if (/\b(remote|anywhere|worldwide|work from home|wfh|distributed)\b/.test(text)) return 'remote';
  if (/\b(on-?site|in-?office)\b/.test(text)) return 'onsite';
  return 'unknown';
}

function compactAmount(n) {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n));
}

export function formatSalary(min, max, currency) {
  if (!min && !max) return null;
  const range = min && max && min !== max ? `${compactAmount(min)}–${compactAmount(max)}` : compactAmount(min || max);
  return `${currency ? `${currency} ` : ''}${range}`;
}

/**
 * Map a provider's raw job into the canonical Job fields. Returns null for
 * listings that can't be shown safely (no id, title or valid http(s) URL).
 */
export function normalizeListing(raw, source) {
  if (!raw || typeof raw !== 'object') return null;

  const externalId = clean(raw.externalId, 200);
  const title = clean(raw.title, LIMITS.title);
  const url = safeUrl(raw.url);
  if (!externalId || !title || !url) return null;

  const location = clean(raw.location, LIMITS.location) || 'Unspecified';
  const description = (raw.descriptionHtml ? stripHtml(raw.descriptionHtml) : clean(raw.description, LIMITS.description))
    .slice(0, LIMITS.description);
  const salaryMin = toPositiveNumber(raw.salaryMin);
  const salaryMax = toPositiveNumber(raw.salaryMax);
  const salaryCurrency = clean(raw.salaryCurrency, 8).toUpperCase() || null;

  return {
    source,
    externalId,
    title,
    company: clean(raw.company, LIMITS.company) || 'Unknown company',
    location,
    description: description || title,
    salaryText: clean(raw.salaryText, LIMITS.salaryText) || formatSalary(salaryMin, salaryMax, salaryCurrency),
    salaryMin,
    salaryMax,
    salaryCurrency,
    url,
    applyUrl: safeUrl(raw.applyUrl),
    postedAt: toDate(raw.postedAt),
    employmentType: clean(raw.employmentType, LIMITS.employmentType) || null,
    remoteType: ['remote', 'hybrid', 'onsite'].includes(raw.remoteType)
      ? raw.remoteType
      : detectRemoteType(location, title),
  };
}
