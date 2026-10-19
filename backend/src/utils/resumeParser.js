import path from 'path';

const KNOWN_ROLES = [
  { match: /frontend|front-end|react engineer|ui developer/i, title: 'Senior Frontend Engineer' },
  { match: /backend|back-end|node\.?js developer|api engineer/i, title: 'Backend Engineer' },
  { match: /full[- ]?stack/i, title: 'Full Stack Engineer' },
  { match: /devops|sre|cloud engineer/i, title: 'DevOps / Cloud Engineer' },
  { match: /mobile|ios|android|react native/i, title: 'Mobile Engineer' },
  { match: /data engineer|data scientist/i, title: 'Data Engineer' },
  { match: /software engineer|software developer/i, title: 'Software Engineer' },
];

const KNOWN_SKILLS = [
  'React',
  'Next.js',
  'TypeScript',
  'JavaScript',
  'Tailwind CSS',
  'Node.js',
  'HTML/CSS',
  'Redux',
  'GraphQL',
  'REST APIs',
  'Express',
  'MongoDB',
  'PostgreSQL',
  'SQL',
  'Docker',
  'Kubernetes',
  'AWS',
  'Python',
  'Git',
  'Jest',
  'Vitest',
  'CI/CD',
  'Vite',
];

const SENIORITY_MAP = [
  { match: /\b(staff)\b/i, level: 'staff', salary: { min: 190000, max: 270000 } },
  { match: /\b(principal)\b/i, level: 'principal', salary: { min: 210000, max: 300000 } },
  { match: /\b(lead|tech lead)\b/i, level: 'lead', salary: { min: 175000, max: 250000 } },
  { match: /\b(senior|sr\.?)\b/i, level: 'senior', salary: { min: 150000, max: 220000 } },
  { match: /\b(junior|jr\.?|entry|intern)\b/i, level: 'entry', salary: { min: 85000, max: 125000 } },
  { match: /\b(mid|mid-level|intermediate)\b/i, level: 'mid', salary: { min: 115000, max: 165000 } },
];

/**
 * Extracts printable ASCII / text tokens from a buffer (handles PDF, DOCX XML, plain text).
 */
export function extractTextFromBuffer(buffer, filename = '') {
  let text = filename + ' ';
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return text;
  }

  // Raw string extraction
  const raw = buffer.toString('utf-8', 0, Math.min(buffer.length, 500000));

  // Extract text inside XML tags <w:t>...</w:t> for DOCX files
  const docxMatches = raw.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
  if (docxMatches && docxMatches.length > 0) {
    const docxText = docxMatches.map((m) => m.replace(/<[^>]+>/g, '')).join(' ');
    text += docxText + ' ';
  }

  // Extract PDF text between parentheses (e.g. (text) Tj)
  const pdfMatches = raw.match(/\(([^)]+)\)\s*(?:Tj|TJ|\')/g);
  if (pdfMatches && pdfMatches.length > 0) {
    const pdfText = pdfMatches.map((m) => m.replace(/[()]/g, '')).join(' ');
    text += pdfText + ' ';
  }

  // General alphanumeric token stream
  const cleanTokens = raw.replace(/[^\x20-\x7E\n\r\t]/g, ' ');
  text += cleanTokens;

  return text;
}

/**
 * Parses resume buffer and filename to extract search criteria:
 * - titles
 * - keywords (skills)
 * - seniority
 * - locations
 * - salaryMin, salaryMax
 */
export function parseResumeData(buffer, originalFilename = '') {
  const combinedText = extractTextFromBuffer(buffer, originalFilename);

  // 1. Detect Job Title / Role
  const detectedTitles = [];
  for (const { match, title } of KNOWN_ROLES) {
    if (match.test(combinedText)) {
      if (!detectedTitles.includes(title)) {
        detectedTitles.push(title);
      }
    }
  }

  if (detectedTitles.length === 0) {
    detectedTitles.push('Senior Frontend Engineer');
  }

  // 2. Detect Skills / Keywords
  const detectedSkills = [];
  for (const skill of KNOWN_SKILLS) {
    // Word boundary match
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9])${escaped}(?:$|[^a-zA-Z0-9])`, 'i');
    if (regex.test(combinedText)) {
      detectedSkills.push(skill);
    }
  }

  // Default baseline skills if none detected
  if (detectedSkills.length === 0) {
    if (/backend/i.test(detectedTitles[0])) {
      detectedSkills.push('Node.js', 'TypeScript', 'Express', 'MongoDB', 'PostgreSQL');
    } else {
      detectedSkills.push('React', 'Next.js', 'TypeScript', 'Tailwind CSS');
    }
  }

  // 3. Detect Seniority and Salary Range
  let detectedSeniority = 'mid';
  let salaryRange = { min: 150000, max: 220000 };

  for (const { match, level, salary } of SENIORITY_MAP) {
    if (match.test(combinedText)) {
      detectedSeniority = level;
      salaryRange = salary;
      break;
    }
  }

  // If detected title has 'Senior', promote seniority
  if (/senior/i.test(detectedTitles[0]) && detectedSeniority === 'mid') {
    detectedSeniority = 'senior';
    salaryRange = { min: 150000, max: 220000 };
  }

  // 4. Locations
  const locations = ['Remote'];
  if (/hybrid/i.test(combinedText)) {
    locations.push('Hybrid');
  }

  return {
    titles: detectedTitles.slice(0, 3),
    keywords: detectedSkills.slice(0, 10),
    locations,
    seniority: detectedSeniority,
    salaryMin: salaryRange.min,
    salaryMax: salaryRange.max,
    summary: `Extracted ${detectedTitles[0]} profile with skills: ${detectedSkills.slice(0, 4).join(', ')}.`,
  };
}
