"use server";

import { db, toJson } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { FREE_PROFILE_LIMIT, canAddSearchProfile } from "@/lib/plans";
import { getSessionUser } from "@/lib/auth";
import { cookies } from "next/headers";

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
  resumeFileName?: string | null;
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

  // 1. Sync to MongoDB via Express API
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get("jr_session");
  const API_INTERNAL = process.env.API_INTERNAL_URL || "http://localhost:4000";

  let syncedMongoId: string | null = null;

  if (sessionCookie?.value) {
    try {
      const listRes = await fetch(`${API_INTERNAL}/api/v1/profiles`, {
        headers: { Cookie: `jr_session=${sessionCookie.value}` },
        cache: "no-store",
      });
      const listData = listRes.ok ? await listRes.json() : null;
      const userProfiles = listData?.profiles || [];

      // If user has a placeholder or backend profile, update it
      const placeholder = userProfiles.find(
        (p: any) => /backend/i.test(p.name) || (p.titles?.length === 1 && /backend/i.test(p.titles[0]))
      );

      if (placeholder) {
        const patchRes = await fetch(`${API_INTERNAL}/api/v1/profiles/${placeholder._id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: `jr_session=${sessionCookie.value}`,
          },
          body: JSON.stringify({
            name: data.titles[0] ?? "Search Profile",
            titles: data.titles,
            keywords: data.keywords,
            locations: data.locations,
            seniority: data.seniority,
            salaryMin: data.salaryMin,
            salaryMax: data.salaryMax,
          }),
        });
        if (patchRes.ok) {
          const patchData = await patchRes.json();
          syncedMongoId = patchData.profile?._id;
        }
      } else {
        const postRes = await fetch(`${API_INTERNAL}/api/v1/profiles`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `jr_session=${sessionCookie.value}`,
          },
          body: JSON.stringify({
            name: data.titles[0] ?? `My search ${existingCount + 1}`,
            titles: data.titles,
            keywords: data.keywords,
            locations: data.locations,
            seniority: data.seniority,
            salaryMin: data.salaryMin,
            salaryMax: data.salaryMax,
          }),
        });
        if (postRes.ok) {
          const postData = await postRes.json();
          syncedMongoId = postData.profile?._id;
        }
      }
    } catch (err) {
      console.error("Failed to sync profile to MongoDB API:", err);
    }
  }

  // 2. Sync Resume if uploaded
  if (data.resumeFileName) {
    if (sessionCookie?.value) {
      try {
        await fetch(`${API_INTERNAL}/api/v1/resumes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `jr_session=${sessionCookie.value}`,
          },
          body: JSON.stringify({
            fileUrl: data.resumeFileName,
            parsedData: {
              summary: `Resume parsed for ${data.titles[0] || "Frontend Developer"}`,
              skills: data.keywords.length > 0 ? data.keywords : ["TypeScript", "React", "Next.js", "Tailwind CSS"],
              roles: data.titles.length > 0 ? data.titles : ["Frontend Developer"],
              experience: "3+ years",
            },
          }),
        });
      } catch (err) {
        console.error("Failed to sync resume to MongoDB API:", err);
      }
    }

    try {
      await db.resume.create({
        data: {
          userId: user.id,
          fileUrl: data.resumeFileName,
          parsedJson: toJson({
            summary: `Resume parsed for ${data.titles[0] || "Frontend Developer"}`,
            skills: data.keywords.length > 0 ? data.keywords : ["TypeScript", "React", "Next.js", "Tailwind CSS"],
            roles: data.titles.length > 0 ? data.titles : ["Frontend Developer"],
            experience: "3+ years",
          }),
        },
      });
    } catch (err) {
      console.error("Failed to save resume in SQLite:", err);
    }
  }

  // 3. Keep SQLite in sync with identical ID and structure
  try {
    const existingPlaceholder = await db.searchProfile.findFirst({
      where: { userId: user.id },
    });

    if (existingPlaceholder && (/backend/i.test(existingPlaceholder.name) || /backend/i.test(existingPlaceholder.titles))) {
      await db.searchProfile.update({
        where: { id: existingPlaceholder.id },
        data: {
          name: data.titles[0] ?? `My search 1`,
          titles: toJson(data.titles),
          keywords: toJson(data.keywords),
          locations: toJson(data.locations),
          seniority: data.seniority,
          salaryMin: data.salaryMin,
          salaryMax: data.salaryMax,
        },
      });
    } else {
      await db.searchProfile.create({
        data: {
          id: syncedMongoId || undefined,
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
    }
  } catch (_err) {
    // Handled
  }

  revalidatePath("/feed");
  revalidatePath("/profile");
  revalidatePath("/billing");
}
