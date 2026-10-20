/**
 * Extracts job listings from LinkedIn / Naukri / Indeed job-alert email HTML.
 *
 * Alert emails have no stable structure, so this works from the links: every
 * link that points at a job page identifies one job (by its id), the link text
 * is the title, and the text that follows (until the next job) usually holds
 * company and location.
 */

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·' };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') {
      const num = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(num) ? String.fromCodePoint(num) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

function cleanText(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** All candidate URLs hidden in an href, including ones wrapped by click-trackers. */
function candidateUrls(href) {
  const urls = new Set([href]);
  let current = href;
  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      urls.add(decoded);
      current = decoded;
    } catch {
      break;
    }
  }
  for (const url of [...urls]) {
    for (const m of url.matchAll(/https?:\/\/[^\s"'<>&]+(?:&[^\s"'<>]*)?/g)) urls.add(m[0]);
  }
  return [...urls];
}

const JOB_URL_PATTERNS = [
  {
    source: 'linkedin',
    pattern: /linkedin\.com\/(?:comm\/)?jobs\/view\/(?:[^/?#\s]*?-)?(\d{6,})/i,
    canonical: (m) => `https://www.linkedin.com/jobs/view/${m[1]}/`,
  },
  {
    source: 'naukri',
    pattern: /naukri\.com\/(job-listings-[a-z0-9-]*?-(\d{9,}))/i,
    canonical: (m) => `https://www.naukri.com/${m[1]}`,
    id: (m) => m[2],
  },
  {
    source: 'indeed',
    // jk must be in this URL's own query string, not inside a wrapped redirect URL
    pattern: /\/\/([a-z0-9.-]*?)\.?indeed\.([a-z.]+?)\/[^\s"'?]*\?(?:[^\s"'#?]*&)?jk=([0-9a-f]{16})/i,
    // Tracking hosts (cts., click.) are not job pages; keep only a 2-letter country subdomain
    canonical: (m) => {
      const country = /^[a-z]{2}$/i.test(m[1]) ? m[1].toLowerCase() : 'www';
      return `https://${country}.indeed.${m[2].toLowerCase()}/viewjob?jk=${m[3]}`;
    },
    id: (m) => m[3],
  },
];

export function matchJobUrl(href) {
  for (const url of candidateUrls(href)) {
    for (const { source, pattern, canonical, id } of JOB_URL_PATTERNS) {
      const m = url.match(pattern);
      if (m) return { source, externalId: id ? id(m) : m[1], url: canonical(m) };
    }
  }
  return null;
}

// Link texts that are buttons, not job titles
const CTA_TEXT = /^(view( job| details| all| more)?|apply( now)?|easy apply|see (all|more)( jobs)?|save|more|search|jobs?|\d+\+? (new )?jobs?.*|show more.*)$/i;
// Lines that are badges/metadata rather than company or location
const NOISE_TEXT =
  /^(promoted|actively recruiting|easy apply|be an early applicant|new|apply|view job|top applicant|\d+ (applicants?|connections?|alumni|school alumni).*|\d+ (hours?|days?|weeks?) ago|just now|reviews?|\d+(\.\d+)? ?★?|\(?\d+(\.\d+)?\)?)$/i;

function tokenize(html) {
  const body = html
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ');

  const tokens = [];
  const anchorRe = /<a\b[^>]*?href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let last = 0;
  const pushText = (chunk) => {
    for (const line of chunk.split(/<\/?(?:br|p|div|td|tr|li|h\d|table|tbody|span|strong|b)\b[^>]*>/i)) {
      const text = cleanText(line);
      if (text) tokens.push({ type: 'text', text });
    }
  };
  for (const m of body.matchAll(anchorRe)) {
    pushText(body.slice(last, m.index));
    tokens.push({ type: 'link', href: decodeEntities(m[2]), text: cleanText(m[3]) });
    last = m.index + m[0].length;
  }
  pushText(body.slice(last));
  return tokens;
}

/**
 * @param {string} html email body
 * @returns {Array<{source,externalId,title,company,location,description,salaryText,url}>}
 */
export function parseJobAlertEmail(html) {
  if (!html) return [];

  const jobs = new Map();
  let current = null;

  for (const token of tokenize(html)) {
    const job = token.type === 'link' ? matchJobUrl(token.href) : null;
    if (job) {
      const key = `${job.source}:${job.externalId}`;
      if (!jobs.has(key)) jobs.set(key, { ...job, titles: [], lines: [] });
      current = jobs.get(key);
      if (token.text && !CTA_TEXT.test(token.text)) current.titles.push(token.text);
    } else if (current && token.text) {
      current.lines.push(token.text);
    }
  }

  const listings = [];
  for (const job of jobs.values()) {
    const title = job.titles.sort((a, b) => b.length - a.length)[0] || job.lines[0];
    if (!title || title.length > 200) continue;

    const details = job.lines
      .filter((line) => line !== title && !CTA_TEXT.test(line) && !NOISE_TEXT.test(line) && line.length <= 120)
      .flatMap((line) => line.split(/\s+[·•|]\s+/))
      .map((line) => line.trim())
      .filter(Boolean);

    const [company = 'Unknown company', location = 'Unspecified'] = details;
    listings.push({
      source: job.source,
      externalId: job.externalId,
      title,
      company,
      location,
      description: [title, company, location, ...details.slice(2, 8)].join(' · '),
      salaryText: details.find((d) => /(₹|\$|€|£|\blpa\b|\blacs?\b|\blakhs?\b|\bctc\b|per (year|month|annum)|\/yr)/i.test(d)) || null,
      url: job.url,
    });
  }
  return listings;
}
