"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getApiInternalUrl } from "@/lib/apiUrl";

const API_INTERNAL = getApiInternalUrl();

function getAuthHeaders() {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get("jr_session");
  return {
    "Content-Type": "application/json",
    Cookie: sessionCookie?.value ? `jr_session=${sessionCookie.value}` : "",
  };
}

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
  try {
    await fetch(`${API_INTERNAL}/api/v1/profiles/${id}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        name: data.titles[0] || "Search Profile",
        titles: data.titles,
        keywords: data.keywords,
        locations: data.locations,
        seniority: data.seniority,
        salaryMin: data.salaryMin,
        salaryMax: data.salaryMax,
      }),
    });
  } catch (err) {
    console.error("Failed to update profile in MongoDB API:", err);
  }

  revalidatePath("/profile");
  revalidatePath("/feed");
}

export async function replaceResume(_userId: string, _fileName: string) {
  revalidatePath("/profile");
  revalidatePath("/feed");
}

export async function deleteSearchProfile(id: string) {
  try {
    await fetch(`${API_INTERNAL}/api/v1/profiles/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
  } catch (err) {
    console.error("Failed to delete profile from MongoDB:", err);
  }

  revalidatePath("/profile");
  revalidatePath("/feed");
}

export async function updateUserAvatar(_userId: string, _avatarUrl: string) {
  revalidatePath("/profile");
  revalidatePath("/feed");
  revalidatePath("/drafts");
  revalidatePath("/tracker");
}
