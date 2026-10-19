import type { NormalizedListing } from "./types";

// Greenhouse's public job-board API — no auth, no scraping, exactly the
// "High reliability" source type described in section 2.1 of the project
// documentation. Every company on Greenhouse exposes:
//   GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true
// The board token is the slug in that company's public careers URL, e.g.
// https://boards.greenhouse.io/acme -> board token "acme".

interface GreenhouseJob {
  id: number;
  title: string;
  updated_at: string;
  location?: { name?: string };
  content?: string;
  absolute_url: string;
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchGreenhouseListings(
  boardToken: string
): Promise<NormalizedListing[]> {
  const res = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`,
    { next: { revalidate: 0 } }
  );

  if (!res.ok) {
    throw new Error(
      `Greenhouse board "${boardToken}" returned ${res.status} — check the board token in your careers-page URL (boards.greenhouse.io/<token>).`
    );
  }

  const data = (await res.json()) as GreenhouseResponse;

  return data.jobs.map((job) => ({
    source: "greenhouse",
    externalId: String(job.id),
    title: job.title,
    company: boardToken,
    location: job.location?.name ?? "Unspecified",
    description: job.content ? stripHtml(job.content) : "",
    salaryText: null,
    url: job.absolute_url,
  }));
}

export async function fetchAllGreenhouseListings(
  boardTokens: string[]
): Promise<NormalizedListing[]> {
  const results = await Promise.allSettled(
    boardTokens.map((token) => fetchGreenhouseListings(token))
  );

  const listings: NormalizedListing[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      listings.push(...result.value);
    } else {
      console.error("[greenhouse connector]", result.reason);
    }
  }
  return listings;
}
