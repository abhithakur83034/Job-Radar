/**
 * Résumé parsing: real text extraction (PDF via pdf-parse, DOCX via mammoth, plain text)
 * followed by honest field detection. Nothing is invented: when a field can't be found
 * in the text it is returned empty / null.
 */
import path from 'path';
// Import the library entry directly: the package index runs a debug block that reads a
// test PDF from disk when it thinks it's the main module.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import { SKILLS, skillPattern, skillDisplayName } from './skills.js';

export const MAX_INPUT_BYTES = 20 * 1024 * 1024; // same limit as the upload middleware
export const MAX_TEXT_CHARS = 200_000;
const EXTRACTION_TIMEOUT_MS = 15_000;
const MAX_PDF_PAGES = 50;
const MAX_SKILLS = 25;
const MAX_TITLES = 5;

// ---------------------------------------------------------------------------
// Text extraction
// ---------------------------------------------------------------------------

function detectFormat(buffer, filename) {
  const ext = path.extname(filename || '').toLowerCase();
  const head = buffer.subarray(0, 8);
  if (head.subarray(0, 5).toString('latin1') === '%PDF-' || ext === '.pdf') return 'pdf';
  const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  if (isZip || ext === '.docx') return 'docx';
  const isOle = head.toString('hex') === 'd0cf11e0a1b11ae1'; // legacy MS Office container
  if (isOle || ext === '.doc') return 'doc';
  return 'text';
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`extraction timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function extractPdf(buffer) {
  // Copy into a standalone Uint8Array: small Node Buffers share a pooled ArrayBuffer at a
  // non-zero offset, which the bundled pdf.js (v1.10) mis-reads, and the copy also keeps
  // pdf.js away from the caller's buffer.
  const result = await pdfParse(new Uint8Array(buffer), { max: MAX_PDF_PAGES });
  return result?.text || '';
}

async function extractDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result?.value || '';
}

/**
 * Best-effort fallback for legacy binary .doc files (no maintained pure-JS parser).
 * Word 97-2003 stores body text either as 8-bit (cp1252) or UTF-16LE runs inside the
 * OLE container, so we collect long-enough runs of printable characters from both
 * decodings. This yields the body text plus some noise (style names, metadata), which
 * the downstream matchers tolerate. It never throws.
 */
function extractLegacyDoc(buffer) {
  const runs = [];
  const asciiRuns = buffer.toString('latin1').match(/[\x20-\x7E\t\r\n]{6,}/g) || [];
  const utf16Runs = buffer.toString('utf16le').match(/[\x20-\x7E -ɏ–-”\t\r\n]{6,}/g) || [];
  runs.push(...utf16Runs, ...asciiRuns);
  return runs.join('\n');
}

function extractPlainText(buffer) {
  return buffer.toString('utf8').replace(/^﻿/, '');
}

/**
 * Extract readable text from a résumé file. Never throws: unreadable, encrypted or
 * malformed files produce ''.
 */
export async function extractResumeText(buffer, filename = '') {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) return '';
  const input = buffer.length > MAX_INPUT_BYTES ? buffer.subarray(0, MAX_INPUT_BYTES) : buffer;

  let text = '';
  try {
    switch (detectFormat(input, filename)) {
      case 'pdf':
        text = await withTimeout(extractPdf(input), EXTRACTION_TIMEOUT_MS);
        break;
      case 'docx':
        text = await withTimeout(extractDocx(input), EXTRACTION_TIMEOUT_MS);
        break;
      case 'doc':
        text = extractLegacyDoc(input);
        break;
      default:
        text = extractPlainText(input);
    }
  } catch {
    text = '';
  }

  return normalizeText(String(text || '').slice(0, MAX_TEXT_CHARS));
}

function normalizeText(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

// Vocabulary entries that are also everyday English words: an all-lowercase hit
// ("go to market", "the rest of", "express interest") is not counted as the skill.
const COMMON_WORD_HITS = new Set(['go', 'rest', 'express', 'spring', 'swift', 'spark', 'dart', 'rust']);

const globalPatternCache = new Map();
function globalSkillPattern(canonical) {
  if (!globalPatternCache.has(canonical)) {
    const p = skillPattern(canonical);
    globalPatternCache.set(canonical, new RegExp(p.source, 'gi'));
  }
  return globalPatternCache.get(canonical);
}

/** Skills found in the text, most frequently mentioned first (display names). */
export function extractSkills(text, limit = MAX_SKILLS) {
  if (!text) return [];
  const found = [];
  for (const canonical of Object.keys(SKILLS)) {
    const re = globalSkillPattern(canonical);
    re.lastIndex = 0;
    let count = 0;
    let first = -1;
    for (const m of text.matchAll(re)) {
      if (COMMON_WORD_HITS.has(m[0])) continue;
      count += 1;
      if (first === -1) first = m.index;
    }
    if (count > 0) found.push({ name: skillDisplayName(canonical), count, first });
  }
  found.sort((a, b) => b.count - a.count || a.first - b.first);
  return [...new Set(found.map((s) => s.name))].slice(0, limit);
}

// ---------------------------------------------------------------------------
// Roles / titles
// ---------------------------------------------------------------------------

const ROLE_NOUN = '(?:engineer|developer|programmer)';
const ROLE_PATTERNS = [
  { title: 'Full Stack Engineer', re: new RegExp(`\\bfull[\\s-]?stack\\s+(?:web\\s+)?${ROLE_NOUN}`, 'gi') },
  { title: 'Frontend Engineer', re: new RegExp(`\\b(?:front[\\s-]?end|ui|react(?:\\.?js)?|angular|vue(?:\\.?js)?)\\s+${ROLE_NOUN}`, 'gi') },
  { title: 'Backend Engineer', re: new RegExp(`\\b(?:back[\\s-]?end|node(?:\\.?js)?|api|java|python|golang|go)\\s+${ROLE_NOUN}`, 'gi') },
  { title: 'Mobile Engineer', re: new RegExp(`\\b(?:mobile|ios|android|react\\s+native|flutter)\\s+(?:app\\s+|application\\s+)?${ROLE_NOUN}`, 'gi') },
  { title: 'DevOps Engineer', re: /\b(?:devops|dev ops|platform|cloud|infrastructure)\s+engineer|\bsite\s+reliability\s+engineer|\bsre\b/gi },
  { title: 'Data Engineer', re: /\b(?:data|big\s+data|etl)\s+engineer/gi },
  { title: 'Data Scientist', re: /\bdata\s+scientist/gi },
  { title: 'Machine Learning Engineer', re: /\b(?:machine\s+learning|ml|ai)\s+engineer/gi },
  { title: 'QA Engineer', re: /\b(?:qa|quality\s+assurance|test\s+automation|automation\s+test|test)\s+(?:engineer|analyst)\b|\bsdet\b/gi },
  { title: 'Engineering Manager', re: /\b(?:engineering|software\s+development)\s+manager/gi },
  { title: 'Software Architect', re: /\b(?:software|solutions?|technical|cloud)\s+architect/gi },
  { title: 'Product Manager', re: /\bproduct\s+manager/gi },
  { title: 'Tech Lead', re: /\b(?:tech(?:nical)?|team)\s+lead\b/gi },
  { title: 'Software Engineer', re: new RegExp(`\\b(?:software|web|application)\\s+${ROLE_NOUN}|\\bSDE(?:[\\s-]?(?:I{1,3}|[123]))?\\b`, 'gi') },
];

/**
 * Target roles actually mentioned in the text, ordered by first appearance (the
 * headline / most recent job usually comes first). Returns [] when none are found.
 */
export function extractTitles(text, limit = MAX_TITLES) {
  if (!text) return [];
  const hits = [];
  for (const { title, re } of ROLE_PATTERNS) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) hits.push({ title, index: m.index });
  }
  hits.sort((a, b) => a.index - b.index);
  return hits.map((h) => h.title).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Years of experience
// ---------------------------------------------------------------------------

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};
const MONTH_NAME = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DATE_PART = `(?:(${MONTH_NAME})\\.?,?\\s*|(\\d{1,2})\\s*[/.-]\\s*)?((?:19|20)\\d{2})`;
const END_PART = `(?:${DATE_PART}|(present|current|now|till\\s+date|to\\s+date|today|ongoing))`;
const RANGE_RE = new RegExp(`${DATE_PART}\\s*(?:-|–|—|to|till|until)\\s*${END_PART}`, 'gi');

const SECTION_START_RE = /^\s*(?:professional\s+|work\s+|relevant\s+)?(?:experience|employment(?:\s+history)?|work\s+history|career\s+history)\s*:?\s*$/im;
const SECTION_END_RE = /^\s*(?:education|academic|projects?|personal\s+projects|skills|technical\s+skills|certifications?|achievements|awards|publications|languages|interests|hobbies)\b[^\n]{0,30}$/im;

/** The experience section of a résumé, or the whole text when no heading is found. */
function experienceSection(text) {
  const start = SECTION_START_RE.exec(text);
  if (!start) return text;
  const rest = text.slice(start.index + start[0].length);
  const end = SECTION_END_RE.exec(rest);
  return end ? rest.slice(0, end.index) : rest;
}

function monthIndexOf(name, num) {
  if (name) return MONTHS[name.toLowerCase().slice(0, name.toLowerCase().startsWith('sept') ? 4 : 3)] ?? null;
  if (num) {
    const n = Number(num);
    return n >= 1 && n <= 12 ? n - 1 : null;
  }
  return null;
}

/**
 * Employment date ranges as [startMonth, endMonth) absolute month numbers.
 * "Jan 2019 – Dec 2019" counts 12 months; "2018 - 2021" counts 3 years.
 */
export function extractDateRanges(text, now = new Date()) {
  const ranges = [];
  const nowMonth = now.getFullYear() * 12 + now.getMonth() + 1;
  for (const m of text.matchAll(RANGE_RE)) {
    const [, sName, sNum, sYear, eName, eNum, eYear, ongoing] = m;
    const sMonth = monthIndexOf(sName, sNum);
    const start = Number(sYear) * 12 + (sMonth ?? 0);
    let end;
    if (ongoing) {
      end = nowMonth;
    } else {
      const eMonth = monthIndexOf(eName, eNum);
      // Month-precise end dates are inclusive; year-only ranges count whole years.
      end = Number(eYear) * 12 + (eMonth === null ? 0 : eMonth + 1);
    }
    if (Number(sYear) < 1970 || start >= nowMonth || end <= start) continue;
    ranges.push([start, Math.min(end, nowMonth)]);
  }
  return ranges;
}

/** Total months covered by possibly-overlapping ranges. */
export function mergedMonths(ranges) {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cur = null;
  for (const [s, e] of sorted) {
    if (!cur || s > cur[1]) {
      if (cur) total += cur[1] - cur[0];
      cur = [s, e];
    } else {
      cur[1] = Math.max(cur[1], e);
    }
  }
  if (cur) total += cur[1] - cur[0];
  return total;
}

const EXPLICIT_YEARS_RE = /(\d{1,2}(?:\.\d{1,2})?)\s*\+?\s*(?:years?|yrs?)(?:\s+and\s+\d{1,2}\s+months?)?(?:\s+of)?(?:\s+[a-z/.+-]+){0,3}?\s+(?:experience|exp\b)/gi;
const EXPERIENCE_OF_RE = /experience\s+of\s+(\d{1,2}(?:\.\d{1,2})?)\s*\+?\s*(?:years?|yrs?)/gi;

/** Years of experience (one decimal) from explicit statements and/or date ranges, or null. */
export function extractYearsExperience(text, now = new Date()) {
  if (!text) return null;
  let explicit = 0;
  for (const re of [EXPLICIT_YEARS_RE, EXPERIENCE_OF_RE]) {
    for (const m of text.matchAll(re)) {
      const n = Number(m[1]);
      if (n > 0 && n <= 50) explicit = Math.max(explicit, n);
    }
  }
  const months = mergedMonths(extractDateRanges(experienceSection(text), now));
  const fromRanges = months > 0 && months <= 50 * 12 ? months / 12 : 0;
  const years = Math.max(explicit, fromRanges);
  return years > 0 ? Math.round(years * 10) / 10 : null;
}

// ---------------------------------------------------------------------------
// Seniority
// ---------------------------------------------------------------------------

const TITLE_NOUNS = '(?:[a-z.+#/-]+\\s+){0,3}?(?:engineer|developer|programmer|architect|scientist|analyst|designer|manager|consultant|sde)';
const SENIORITY_WORDS = [
  { level: 'principal', re: new RegExp(`\\bprincipal\\s+${TITLE_NOUNS}`, 'i') },
  { level: 'staff', re: new RegExp(`\\bstaff\\s+${TITLE_NOUNS}`, 'i') },
  { level: 'lead', re: new RegExp(`\\blead\\s+${TITLE_NOUNS}|\\b(?:tech(?:nical)?|team|engineering)\\s+lead\\b`, 'i') },
  { level: 'senior', re: new RegExp(`\\b(?:senior|sr\\.?)\\s+${TITLE_NOUNS}`, 'i') },
  { level: 'entry', re: new RegExp(`\\b(?:junior|jr\\.?|associate|graduate|trainee)\\s+${TITLE_NOUNS}|\\b(?:intern|internship)\\b`, 'i') },
];

/** Seniority stated in a job title; the earliest mention (headline / latest role) wins. */
function seniorityFromTitles(text) {
  let best = null;
  for (const { level, re } of SENIORITY_WORDS) {
    const m = re.exec(text);
    if (m && (!best || m.index < best.index)) best = { level, index: m.index };
  }
  return best?.level ?? null;
}

function seniorityFromYears(years) {
  if (years === null || years === undefined) return null;
  if (years < 2) return 'entry';
  if (years < 5) return 'mid';
  if (years < 9) return 'senior';
  return 'staff';
}

export function extractSeniority(text, yearsExperience) {
  if (!text) return null;
  return seniorityFromTitles(text) ?? seniorityFromYears(yearsExperience);
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

const LOCATIONS = [
  { name: 'Bengaluru', re: /\b(?:bengaluru|bangalore)\b/i },
  { name: 'Mumbai', re: /\b(?:mumbai|bombay)\b/i },
  { name: 'Pune', re: /\bpune\b/i },
  { name: 'Hyderabad', re: /\bhyderabad\b/i },
  { name: 'Chennai', re: /\bchennai\b/i },
  { name: 'Gurugram', re: /\b(?:gurugram|gurgaon)\b/i },
  { name: 'Noida', re: /\bnoida\b/i },
  { name: 'Delhi', re: /\b(?:new\s+)?delhi\b/i },
  { name: 'Kolkata', re: /\b(?:kolkata|calcutta)\b/i },
  { name: 'Ahmedabad', re: /\bahmedabad\b/i },
  { name: 'India', re: /\bindia\b/i },
  { name: 'Remote', re: /\bremote\b/i },
];

/** Locations mentioned in the text, ordered by first appearance. */
export function extractLocations(text) {
  if (!text) return [];
  return LOCATIONS.map(({ name, re }) => ({ name, m: re.exec(text) }))
    .filter((l) => l.m)
    .sort((a, b) => a.m.index - b.m.index)
    .map((l) => l.name);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function buildSummary({ textLength, keywords, yearsExperience, titles }) {
  if (!textLength) return "Couldn't read text from this file.";
  const parts = [`Found ${keywords.length} skill${keywords.length === 1 ? '' : 's'}`];
  if (yearsExperience !== null) parts.push(`${yearsExperience} years of experience`);
  if (titles.length) parts.push(`roles: ${titles.join(', ')}`);
  return `${parts.join(', ')}.`;
}

/**
 * Parse a résumé file into search criteria. Only values present in the document are
 * returned; salary is never guessed (kept as null for backward compatibility).
 */
export async function parseResumeData(buffer, originalFilename = '', { now = new Date() } = {}) {
  const text = await extractResumeText(buffer, originalFilename);

  const keywords = extractSkills(text);
  const titles = extractTitles(text);
  const locations = extractLocations(text);
  const yearsExperience = extractYearsExperience(text, now);
  const seniority = extractSeniority(text, yearsExperience);

  return {
    titles,
    keywords,
    locations,
    seniority,
    yearsExperience,
    salaryMin: null,
    salaryMax: null,
    summary: buildSummary({ textLength: text.length, keywords, yearsExperience, titles }),
    textLength: text.length,
  };
}
