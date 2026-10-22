/**
 * Scores a job listing against a candidate's résumé and search profile.
 *
 * fitScore (5–99) = title fit (up to 40) + skills found in the job (up to 45)
 *                   + location fit (15).
 * Skills count on a square-root curve (1 of 5 skills is already ~45% of the skill
 * points), because job posts rarely list every skill a candidate has. A listing whose
 * title is unrelated to every target title is capped below typical thresholds, so a
 * shared keyword alone can't make an irrelevant role a "match".
 * Skills match as whole words with common aliases (Node / NodeJS / Node.js,
 * Postgres / PostgreSQL, K8s / Kubernetes, …), so "Java" never matches
 * "JavaScript" and "Go" never matches "good".
 */

// Bump when scoring rules change: the next background refresh re-scores every user once
export const SCORING_VERSION = 2;

const WEIGHTS = { title: 40, skills: 45, location: 15 };
const MIN_TITLE_FIT = 0.34; // below this the title is unrelated
const UNRELATED_TITLE_CAP = 55;

// Canonical skill -> other spellings seen in job posts (all lowercase)
const SKILL_ALIASES = {
  'node.js': ['node', 'nodejs', 'node js'],
  'next.js': ['nextjs', 'next js'],
  'react': ['react.js', 'reactjs', 'react js'],
  'react native': ['react-native'],
  'vue': ['vue.js', 'vuejs'],
  'angular': ['angularjs', 'angular.js'],
  'express': ['express.js', 'expressjs'],
  'nestjs': ['nest.js', 'nest js'],
  'typescript': ['ts'],
  'javascript': ['js', 'ecmascript', 'es6'],
  'postgresql': ['postgres', 'psql'],
  'mongodb': ['mongo', 'mongoose'],
  'mysql': ['my sql'],
  'kubernetes': ['k8s'],
  'golang': ['go lang'],
  'c#': ['csharp', 'c sharp', '.net', 'dotnet'],
  'aws': ['amazon web services'],
  'gcp': ['google cloud', 'google cloud platform'],
  'azure': ['microsoft azure'],
  'ci/cd': ['cicd', 'ci cd', 'continuous integration'],
  'tailwind css': ['tailwind', 'tailwindcss'],
  'graphql': ['graph ql'],
  'machine learning': ['ml'],
  'artificial intelligence': ['ai'],
  'rest': ['restful', 'rest api', 'rest apis'],
};

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

const ALIAS_LOOKUP = new Map();
for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
  for (const name of [canonical, ...aliases]) ALIAS_LOOKUP.set(name, canonical);
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Canonical key for a skill, so "Node.js" and "nodejs" count as the same skill. */
export function canonicalSkill(term) {
  const key = String(term).trim().toLowerCase().replace(/\s+/g, ' ');
  return ALIAS_LOOKUP.get(key) ?? key;
}

const patternCache = new Map();
/** Whole-word regex matching a skill or any of its aliases. */
function skillPattern(canonical) {
  if (!patternCache.has(canonical)) {
    const names = [canonical, ...(SKILL_ALIASES[canonical] ?? [])]
      .sort((a, b) => b.length - a.length)
      .map((n) => escapeRegex(n).replace(/\\?\s+/g, '[\\s-]?'));
    // Word boundaries that also work for names starting/ending in symbols (c#, .net, node.js)
    patternCache.set(canonical, new RegExp(`(?<![a-z0-9+#.])(?:${names.join('|')})(?![a-z0-9+#]|\\.[a-z])`, 'i'));
  }
  return patternCache.get(canonical);
}

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
  if (targetTitles.length && titleFit < MIN_TITLE_FIT) raw = Math.min(raw, UNRELATED_TITLE_CAP);
  const fitScore = Math.max(5, Math.min(99, Math.round(raw)));

  const reasons = [`${matchedSkills.length}/${terms.size || 0} tracked skills present`];
  if (titleFit >= 0.99) reasons.push('title aligns');
  else if (titleFit >= 0.5) reasons.push('title partly aligns');
  if (locationAligns) reasons.push('location aligns');

  return {
    fitScore,
    fitReason: reasons.join(', '),
    matchedSkills,
    missingRequirements,
  };
}
