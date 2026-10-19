import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db, fromJson, toJson } from "@/lib/db";
import { fetchAllGreenhouseListings } from "@/lib/connectors/greenhouse";
import { scoreListing } from "@/lib/scoring";
import type { ParsedResume, SearchProfileInput } from "@/lib/types";

// "7.2 Continuous Monitoring Workflow" — polls connected sources, normalizes
// new listings, and scores each one against every active search profile.
// POST body: { boardTokens: string[] }  (Greenhouse board tokens to poll)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const boardTokens: string[] = Array.isArray(body.boardTokens) ? body.boardTokens : [];

  if (boardTokens.length === 0) {
    return NextResponse.json(
      { error: "Provide boardTokens: string[] — Greenhouse board slugs, e.g. from boards.greenhouse.io/<token>." },
      { status: 400 }
    );
  }

  const normalized = await fetchAllGreenhouseListings(boardTokens);

  let newListingCount = 0;
  let newMatchCount = 0;

  const profiles = await db.searchProfile.findMany({
    include: { user: { include: { resumes: true } } },
  });

  for (const listing of normalized) {
    const existing = await db.listing.findUnique({
      where: { source_externalId: { source: listing.source, externalId: listing.externalId } },
    });

    const stored =
      existing ??
      (await db.listing.create({
        data: {
          source: listing.source,
          externalId: listing.externalId,
          title: listing.title,
          company: listing.company,
          location: listing.location,
          description: listing.description,
          salaryText: listing.salaryText,
          url: listing.url,
        },
      }));

    if (!existing) newListingCount++;
    else continue; // already scored against profiles on a previous sync

    for (const profile of profiles) {
      const resume = profile.user.resumes[0];
      if (!resume) continue;

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

      const score = await scoreListing(parsedResume, profileInput, listing);
      if (score.fit_score < profile.fitThreshold) continue;

      await db.match.create({
        data: {
          listingId: stored.id,
          searchProfileId: profile.id,
          fitScore: score.fit_score,
          fitReason: score.fit_reason,
          matchedSkills: toJson(score.matched_skills),
          missingRequirements: toJson(score.missing_requirements),
          notifiedAt: new Date(),
        },
      });
      newMatchCount++;
    }
  }

  revalidatePath("/feed");

  return NextResponse.json({
    listingsSeen: normalized.length,
    newListings: newListingCount,
    newMatches: newMatchCount,
  });
}
