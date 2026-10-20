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

export async function markFollowUpSent(applicationId: string) {
  try {
    await fetch(`${API_INTERNAL}/api/v1/applications/${applicationId}/status`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({}),
    });
  } catch (err) {
    console.error("Failed to mark follow up sent in MongoDB:", err);
  }
  revalidatePath("/tracker");
}

export async function markApplicationStatus(applicationId: string, status: string) {
  try {
    await fetch(`${API_INTERNAL}/api/v1/applications/${applicationId}/status`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
  } catch (err) {
    console.error("Failed to update application status in MongoDB:", err);
  }
  revalidatePath("/tracker");
}
