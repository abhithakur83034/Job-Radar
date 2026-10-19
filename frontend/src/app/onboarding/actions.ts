"use server";

import { db, toJson } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { FREE_PROFILE_LIMIT, canAddSearchProfile } from "@/lib/plans";
import { getSessionUser } from "@/lib/auth";

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

export async function completeOnboarding(data: OnboardingData) {
  const sessionUser = await getSessionUser();
  let user = await db.user.findFirst({ orderBy: { createdAt: "asc" } });

  if (!user && sessionUser) {
    user = await db.user.create({
      data: {
        id: sessionUser.id,
        name: sessionUser.name,
        email: sessionUser.email,
        plan: data.plan,
        notificationChannel: data.notificationChannel,
        notificationMode: data.notificationMode,
      },
    });
  } else if (!user) {
    user = await db.user.create({
      data: {
        name: "User",
        email: "user@example.com",
        plan: data.plan,
        notificationChannel: data.notificationChannel,
        notificationMode: data.notificationMode,
      },
    });
  } else {
    await db.user.update({
      where: { id: user.id },
      data: {
        plan: data.plan,
        notificationChannel: data.notificationChannel,
        notificationMode: data.notificationMode,
      },
    });
  }

  const existingCount = await db.searchProfile.count({ where: { userId: user.id } });
  if (!canAddSearchProfile(data.plan, existingCount)) {
    throw new Error(
      `The Free plan supports up to ${FREE_PROFILE_LIMIT} search profiles. Choose Active Search or Career Boost above to add another.`
    );
  }

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
