import { canonicalSkill, skillPattern } from './skills.js';

export { canonicalSkill };

/**
 * Scores a job listing against a candidate's résumé and search profile.
 *
 * fitScore (5–99) = title fit (up to 40) + skills found in the job (up to 45)
 *                   + location fit (15).
 * Skills count on a square-root curve (1 of 5 skills is already ~45% of the skill
 * points), because job posts rarely list every skill a candidate has. A listing whose
 * title is unrelated to every target title is capped below typical thresholds, so a
 * shared keyword alone can't make an irrelevant role a "match". A listing whose title
 * states a different career level than the profile's seniority loses points.
 * Skills match as whole words with common aliases (Node / NodeJS / Node.js,
 * Postgres / PostgreSQL, K8s / Kubernetes, …), so "Java" never matches
 * "JavaScript" and "Go" never matches "good".
 */

// Bump when scoring rules change: the next background refresh re-scores every user once
export const SCORING_VERSION = 3;

const WEIGHTS = { title: 40, skills: 45, location: 15 };

// Career levels on one scale; a listing's level is read from its title
const LEVEL_RANK = { intern: -1, entry: 0, mid: 1, senior: 2, lead: 3, staff: 3, principal: 4 };
const LEVEL_PATTERNS = [
  ['intern', /\b(intern|internship|trainee|apprentice)\b/i],
  ['principal', /\b(principal|distinguished|fellow)\b/i],
  ['staff', /\bstaff\b/i],
  ['lead', /\b(lead|manager|head|director|vp)\b/i],
  ['senior', /\b(senior|sr\.?)\b/i],
  ['entry', /\b(junior|jr\.?|entry[\s-]level|graduate|new grad|associate)\b/i],
  ['mid', /\b(mid[\s-]level|intermediate)\b/i],
];
// Points removed by distance between the profile's level and the listing's level
const LEVEL_PENALTY = [0, 5, 15, 25];

/** Career level implied by a job title, or null when the title doesn't say. */
export function listingLevel(title) {
  const found = LEVEL_PATTERNS.find(([, pattern]) => pattern.test(title || ''));
  return found ? found[0] : null;
}

function levelAdjustment(profileLevel, title) {
  if (!profileLevel || profileLevel === 'any' || !(profileLevel in LEVEL_RANK)) return { penalty: 0, level: null };
  const level = listingLevel(title);
  if (!level) return { penalty: 0, level: null };
  const distance = Math.abs(LEVEL_RANK[profileLevel] - LEVEL_RANK[level]);
  return { penalty: LEVEL_PENALTY[Math.min(distance, LEVEL_PENALTY.length - 1)], level };
}
const MIN_TITLE_FIT = 0.34; // below this the title is unrelated
const UNRELATED_TITLE_CAP = 55;

// Role words that carry little meaning on their own in a title
const GENERIC_TITLE_WORDS = new Set(['engineer', 'developer', 'programmer', 'specialist', 'consultant']);
const IGNORED_TITLE_WORDS = new Set([
  'senior', 'sr', 'junior', 'jr', 'lead', 'staff', 'principal', 'head', 'associate', 'intern', 'i', 'ii', 'iii', 'iv',
  'the', 'and', 'of', 'for', 'in', 'a', 'an', 'to', 'with', 'remote',
]);
// Spelling variants of role words, normalised before comparing titles
const TITLE_SYNONYMS = {
  developer: 'engineer', programmer: 'engineer', dev: 'engineer', swe: 'software',
  'back-end': 'backend', 'front-end': 'frontend', 'full-stack': 'fullstack', fullstack: 'fullstack',
  devops: 'devops', sre: 'reliability', ml: 'machine', ai: 'ai',
};

function titleTokens(title) {
  return String(title)
    .toLowerCase()
    .replace(/\b(back|front|full)[\s-]+(end|stack)\b/g, '$1$2')
    .split(/[^a-z0-9+#.-]+/)
    .map((w) => w.replace(/^[.-]+|[.-]+$/g, ''))
    .map((w) => TITLE_SYNONYMS[w] ?? w)
    .filter((w) => w && !IGNORED_TITLE_WORDS.has(w));
}

/** 0–1: how much of a target title's meaning appears in the listing title. */
export function titleSimilarity(targetTitle, listingTitle) {
  const target = [...new Set(titleTokens(targetTitle))];
  if (target.length === 0) return 0;
  const listing = new Set(titleTokens(listingTitle));
  let total = 0;
  let matched = 0;
  for (const word of target) {
    const weight = GENERIC_TITLE_WORDS.has(word) || word === 'engineer' ? 0.3 : 1;
    total += weight;
    if (listing.has(word)) matched += weight;
  }
  return matched / total;
}

export function scoreListing(resume, profile, listing) {
  const title = listing.title || '';
  const haystack = `${title}\n${listing.description || ''}`;

  // Skills from the résumé and profile keywords, de-duplicated by canonical name
  const terms = new Map();
  for (const raw of [...(resume?.parsedData?.skills || resume?.skills || []), ...(profile?.keywords || [])]) {
    const label = String(raw).trim();
    if (label && !terms.has(canonicalSkill(label))) terms.set(canonicalSkill(label), label);
  }
  const matchedSkills = [];
  for (const [canonical, label] of terms) {
    if (skillPattern(canonical).test(haystack)) matchedSkills.push(label);
  }
  const keywordCanon = new Set((profile?.keywords || []).map(canonicalSkill));
  const missingRequirements = (profile?.keywords || []).filter(
    (k) => keywordCanon.has(canonicalSkill(k)) && !matchedSkills.some((m) => canonicalSkill(m) === canonicalSkill(k))
  );

  const targetTitles = profile?.titles || [];
  const titleFit = targetTitles.length ? Math.max(...targetTitles.map((t) => titleSimilarity(t, title))) : 0;

  const locations = (profile?.locations || []).map((l) => String(l).trim().toLowerCase()).filter(Boolean);
  const location = String(listing.location || '').toLowerCase();
  const wantsRemote = locations.some((l) => /^(remote|anywhere|worldwide)$/.test(l));
  const isRemoteJob = listing.remoteType === 'remote' || /\b(remote|anywhere|worldwide)\b/.test(location);
  const locationAligns = locations.some((l) => location.includes(l)) || (wantsRemote && isRemoteJob);

  // With no skills listed, judge on title + location alone (scaled to the full range)
  const skillShare = terms.size ? Math.sqrt(matchedSkills.length / terms.size) : titleFit;
  let raw =
    WEIGHTS.title * titleFit + WEIGHTS.skills * skillShare + (locationAligns || locations.length === 0 ? WEIGHTS.location : 0);
  const seniority = levelAdjustment(profile?.seniority, title);
  raw -= seniority.penalty;
  if (targetTitles.length && titleFit < MIN_TITLE_FIT) raw = Math.min(raw, UNRELATED_TITLE_CAP);
  const fitScore = Math.max(5, Math.min(99, Math.round(raw)));

  const reasons = [`${matchedSkills.length}/${terms.size || 0} tracked skills present`];
  if (titleFit >= 0.99) reasons.push('title aligns');
  else if (titleFit >= 0.5) reasons.push('title partly aligns');
  if (locationAligns) reasons.push('location aligns');
  if (seniority.level && seniority.penalty === 0) reasons.push('level matches');
  else if (seniority.penalty >= 15) reasons.push(`${seniority.level} level`);

  return {
    fitScore,
    fitReason: reasons.join(', '),
    matchedSkills,
    missingRequirements,
  };
}
