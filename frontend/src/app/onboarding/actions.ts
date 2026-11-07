"use server";

import { revalidatePath } from "next/cache";
import { API_UNAVAILABLE_MESSAGE, ApiUnavailableError, getSessionUser } from "@/lib/auth";
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

// Returned rather than thrown: Next.js hides thrown server-action messages in production
export type OnboardingResult = { ok: true } | { ok: false; error: string; signedOut?: boolean };

export async function completeOnboarding(data: OnboardingData): Promise<OnboardingResult> {
  let sessionUser;
  try {
    sessionUser = await getSessionUser();
  } catch (err) {
    if (err instanceof ApiUnavailableError) return { ok: false, error: API_UNAVAILABLE_MESSAGE };
    throw err;
  }
  if (!sessionUser) {
    return { ok: false, signedOut: true, error: "Your session has ended. Please sign in again to finish setup." };
  }

  // 1. Save the search profile (update the starter one if it exists). This is what
  //    drives matching, so a failure here must be reported, not swallowed.
  try {
    const listRes = await fetch(`${API_INTERNAL}/api/v1/profiles`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (!listRes.ok) return { ok: false, error: API_UNAVAILABLE_MESSAGE };
    const listData = await listRes.json();
    const userProfiles = listData?.profiles || [];

    const placeholder = userProfiles.find(
      (p: any) => /backend/i.test(p.name) || (p.titles?.length === 1 && /backend/i.test(p.titles[0]))
    );

    const saveRes = placeholder
      ? await fetch(`${API_INTERNAL}/api/v1/profiles/${placeholder._id}`, {
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
      })
      : await fetch(`${API_INTERNAL}/api/v1/profiles`, {
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

    if (saveRes.status === 401) {
      return { ok: false, signedOut: true, error: "Your session has ended. Please sign in again to finish setup." };
    }
    if (!saveRes.ok) {
      const body = await saveRes.json().catch(() => ({}));
      return { ok: false, error: body.error || "Couldn't save your search criteria. Please try again." };
    }
  } catch (err) {
    console.error("Failed to save search profile:", err);
    return { ok: false, error: API_UNAVAILABLE_MESSAGE };
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
  return { ok: true };
}
