import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db, fromJson, toJson } from "@/lib/db";
import { generateTailoredMaterials } from "@/lib/tailoring";
import type { ParsedResume } from "@/lib/types";

// "10.2 Resume & Cover Letter Tailoring Prompt" — generates (or regenerates)
// the tailored draft for a specific match, ready before the user opens the
// notification, per "7.2 STEP 5: Tailored materials are pre-drafted."
export async function POST(req: NextRequest) {
  const { matchId } = await req.json();
  if (!matchId) {
    return NextResponse.json({ error: "matchId is required." }, { status: 400 });
  }

  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      listing: true,
      searchProfile: { include: { user: { include: { resumes: true } } } },
    },
  });

  if (!match) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }

  const resume = match.searchProfile.user.resumes[0];
  if (!resume) {
    return NextResponse.json({ error: "No résumé on file for this user." }, { status: 400 });
  }

  const parsedResume = fromJson<ParsedResume>(resume.parsedJson, {
    summary: "",
    skills: [],
    roles: [],
    experience: "",
  });

  const materials = await generateTailoredMaterials(parsedResume, {
    source: match.listing.source,
    externalId: match.listing.externalId,
    title: match.listing.title,
    company: match.listing.company,
    location: match.listing.location,
    description: match.listing.description,
    salaryText: match.listing.salaryText,
    url: match.listing.url,
  });

  const draft = await db.tailoredDraft.upsert({
    where: { matchId },
    update: {
      resumeDraft: materials.resume_draft,
      coverLetterDraft: materials.cover_letter_draft,
      changesMade: toJson(materials.changes_made),
    },
    create: {
      matchId,
      resumeDraft: materials.resume_draft,
      coverLetterDraft: materials.cover_letter_draft,
      changesMade: toJson(materials.changes_made),
    },
  });

  revalidatePath("/drafts");
  revalidatePath("/billing"); // usage count ("N of 3 used") depends on TailoredDraft rows
  return NextResponse.json({ draft });
}
