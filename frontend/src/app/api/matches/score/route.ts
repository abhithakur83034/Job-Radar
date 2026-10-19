import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db, fromJson, toJson } from "@/lib/db";
import { scoreListing } from "@/lib/scoring";
import type { ParsedResume, SearchProfileInput } from "@/lib/types";

// On-demand rescoring of one listing against one search profile —
// "10.1 Match Scoring Prompt" — useful for a manual "rescan" action rather
// than waiting for the next scheduled sync.
export async function POST(req: NextRequest) {
  const { listingId, searchProfileId } = await req.json();
  if (!listingId || !searchProfileId) {
    return NextResponse.json({ error: "listingId and searchProfileId are required." }, { status: 400 });
  }

  const [listing, profile] = await Promise.all([
    db.listing.findUnique({ where: { id: listingId } }),
    db.searchProfile.findUnique({ where: { id: searchProfileId }, include: { user: { include: { resumes: true } } } }),
  ]);

  if (!listing || !profile) {
    return NextResponse.json({ error: "Listing or search profile not found." }, { status: 404 });
  }

  const resume = profile.user.resumes[0];
  if (!resume) {
    return NextResponse.json({ error: "No résumé on file for this user." }, { status: 400 });
  }

  const parsedResume = fromJson<ParsedResume>(resume.parsedJson, {
    summary: "",
    skills: [],
    roles: [],
    experience: "",
  });
  const profileInput: SearchProfileInput = {
    titles: fromJson<string[]>(profile.titles, []),
    keywords: fromJson<string[]>(profile.keywords, []),
    locations: fromJson<string[]>(profile.locations, []),
    seniority: profile.seniority,
    salaryMin: profile.salaryMin,
    salaryMax: profile.salaryMax,
  };

  const score = await scoreListing(parsedResume, profileInput, {
    source: listing.source,
    externalId: listing.externalId,
    title: listing.title,
    company: listing.company,
    location: listing.location,
    description: listing.description,
    salaryText: listing.salaryText,
    url: listing.url,
  });

  const match = await db.match.upsert({
    where: { listingId_searchProfileId: { listingId, searchProfileId } },
    update: {
      fitScore: score.fit_score,
      fitReason: score.fit_reason,
      matchedSkills: toJson(score.matched_skills),
      missingRequirements: toJson(score.missing_requirements),
    },
    create: {
      listingId,
      searchProfileId,
      fitScore: score.fit_score,
      fitReason: score.fit_reason,
      matchedSkills: toJson(score.matched_skills),
      missingRequirements: toJson(score.missing_requirements),
    },
  });

  revalidatePath("/feed");
  return NextResponse.json({ match, score });
}
