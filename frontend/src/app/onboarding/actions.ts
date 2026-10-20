"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { cookies } from "next/headers";
import { getApiInternalUrl } from "@/lib/apiUrl";

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

const API_INTERNAL = getApiInternalUrl();

function getAuthHeaders() {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get("jr_session");
  return {
    "Content-Type": "application/json",
    Cookie: sessionCookie?.value ? `jr_session=${sessionCookie.value}` : "",
  };
}

export async function completeOnboarding(data: OnboardingData) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    throw new Error("You must be logged in to complete onboarding.");
  }

  // 1. Check existing profiles in MongoDB
  try {
    const listRes = await fetch(`${API_INTERNAL}/api/v1/profiles`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    const listData = listRes.ok ? await listRes.json() : null;
    const userProfiles = listData?.profiles || [];

    const placeholder = userProfiles.find(
      (p: any) => /backend/i.test(p.name) || (p.titles?.length === 1 && /backend/i.test(p.titles[0]))
    );

    if (placeholder) {
      await fetch(`${API_INTERNAL}/api/v1/profiles/${placeholder._id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: data.titles[0] ?? "Frontend Developer",
          titles: data.titles,
          keywords: data.keywords,
          locations: data.locations,
          seniority: data.seniority,
          salaryMin: data.salaryMin,
          salaryMax: data.salaryMax,
        }),
      });
    } else {
      await fetch(`${API_INTERNAL}/api/v1/profiles`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: data.titles[0] ?? `Search Profile ${userProfiles.length + 1}`,
          titles: data.titles,
          keywords: data.keywords,
          locations: data.locations,
          seniority: data.seniority,
          salaryMin: data.salaryMin,
          salaryMax: data.salaryMax,
        }),
      });
    }
  } catch (err) {
    console.error("Failed to sync profile to MongoDB API:", err);
  }

  // 2. Sync Resume if uploaded
  if (data.resumeFileName) {
    try {
      await fetch(`${API_INTERNAL}/api/v1/resumes`, {
        method: "POST",
        headers: getAuthHeaders(),
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

  revalidatePath("/feed");
  revalidatePath("/profile");
  revalidatePath("/billing");
}
