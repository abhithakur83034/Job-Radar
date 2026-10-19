"use server";

import { revalidatePath } from "next/cache";
import { db, toJson } from "@/lib/db";

export async function updateSearchProfile(
  id: string,
  data: {
    titles: string[];
    keywords: string[];
    locations: string[];
    seniority: string;
    salaryMin: number | null;
    salaryMax: number | null;
  }
) {
  await db.searchProfile.update({
    where: { id },
    data: {
      titles: toJson(data.titles),
      keywords: toJson(data.keywords),
      locations: toJson(data.locations),
      seniority: data.seniority,
      salaryMin: data.salaryMin,
      salaryMax: data.salaryMax,
    },
  });
  revalidatePath("/profile");
  revalidatePath("/feed");
}

// No real PDF/DOCX parsing yet (see README — resume parsing is a later
// build phase), so this honestly only updates the file reference, not the
// extracted skills/roles. The existing parsed content stays as-is.
export async function replaceResume(userId: string, fileName: string) {
  const existing = await db.resume.findFirst({ where: { userId }, orderBy: { uploadedAt: "desc" } });

  if (existing) {
    await db.resume.update({
      where: { id: existing.id },
      data: { fileUrl: fileName, uploadedAt: new Date() },
    });
  } else {
    await db.resume.create({
      data: { userId, fileUrl: fileName, parsedJson: toJson({ summary: "", skills: [], roles: [], experience: "" }) },
    });
  }

  revalidatePath("/profile");
}

export async function deleteSearchProfile(id: string) {
  const profile = await db.searchProfile.findUnique({ where: { id } });
  if (!profile) return;

  const count = await db.searchProfile.count({ where: { userId: profile.userId } });
  if (count <= 1) {
    throw new Error("You need at least one search profile — edit it instead of deleting it.");
  }

  await db.searchProfile.delete({ where: { id } });
  revalidatePath("/profile");
  revalidatePath("/feed");
}
