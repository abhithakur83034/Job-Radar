"use server";

import { db, toJson } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { FREE_PROFILE_LIMIT, canAddSearchProfile } from "@/lib/plans";

export interface OnboardingData {
  titles: string[];
  keywords: string[];
  locations: string[];
  seniority: string;
  salaryMin: number | null;
  salaryMax: number | null;
  notificationMode: "realtime" | "digest";
  notificationChannel: "push" | "whatsapp" | "email";
  plan: "free" | "active_search" | "career_boost";
}

// Single-tenant demo: there's no signup flow yet, so "+ New search profile"
// always adds a new SearchProfile row for the one seeded user rather than
// creating a new account. Free plan is capped at FREE_PROFILE_LIMIT profiles
// (doc 5.2 pricing table); Active Search/Career Boost are unlimited (doc 8.5).
export async function completeOnboarding(data: OnboardingData) {
  const user = await db.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) throw new Error("No demo user found — run `npm run db:seed` first.");

  const existingCount = await db.searchProfile.count({ where: { userId: user.id } });
  if (!canAddSearchProfile(data.plan, existingCount)) {
    throw new Error(
      `The Free plan supports up to ${FREE_PROFILE_LIMIT} search profiles. Choose Active Search or Career Boost above to add another.`
    );
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      plan: data.plan,
      notificationChannel: data.notificationChannel,
      notificationMode: data.notificationMode,
    },
  });

  await db.searchProfile.create({
    data: {
      userId: user.id,
      name: data.titles[0] ?? `My search ${existingCount + 1}`,
      titles: toJson(data.titles),
      keywords: toJson(data.keywords),
      locations: toJson(data.locations),
      seniority: data.seniority,
      salaryMin: data.salaryMin,
      salaryMax: data.salaryMax,
    },
  });

  revalidatePath("/feed");
  revalidatePath("/profile");
  revalidatePath("/billing");
}
