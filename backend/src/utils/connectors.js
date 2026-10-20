function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchGreenhouseListings(boardToken) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Greenhouse board "${boardToken}" returned HTTP ${res.status}`);
  }
  const data = await res.json();
  const jobs = data.jobs || [];

  return jobs.map((job) => ({
    source: 'greenhouse',
    externalId: String(job.id),
    title: job.title,
    company: boardToken,
    location: job.location?.name ?? 'Unspecified',
    description: job.content ? stripHtml(job.content) : '',
    salaryText: null,
    url: job.absolute_url,
  }));
}

export async function fetchLeverListings(company) {
  const url = `https://api.lever.co/v0/postings/${company}?mode=json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Lever board "${company}" returned HTTP ${res.status}`);
  }
  const jobs = await res.json();
  if (!Array.isArray(jobs)) return [];

  return jobs.map((job) => ({
    source: 'lever',
    externalId: String(job.id),
    title: job.text,
    company,
    location: job.categories?.location || 'Unspecified',
    description: job.descriptionPlain || stripHtml(job.description || ''),
    salaryText: job.salaryDescription || null,
    url: job.hostedUrl || job.applyUrl,
  }));
}

export async function fetchAllBoardListings(boardTokens = []) {
  const allListings = [];

  for (const token of boardTokens) {
    try {
      const ghListings = await fetchGreenhouseListings(token);
      allListings.push(...ghListings);
    } catch (_err) {
      // Try Lever as fallback if Greenhouse fails
      try {
        const leverListings = await fetchLeverListings(token);
        allListings.push(...leverListings);
      } catch (_leverErr) {
        // Continue
      }
    }
  }

  return allListings;
}

