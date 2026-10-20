"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getApiInternalUrl } from "@/lib/apiUrl";

const DASHBOARD_PATHS = ["/feed", "/profile", "/drafts", "/tracker", "/billing"];
const API_INTERNAL = getApiInternalUrl();

export async function updateAccountDetails(_userId: string, data: { name?: string; avatarUrl?: string }) {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get("jr_session");

  try {
    await fetch(`${API_INTERNAL}/api/v1/auth/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie?.value ? `jr_session=${sessionCookie.value}` : "",
      },
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.error("Failed to update account details in MongoDB:", err);
  }

  DASHBOARD_PATHS.forEach((path) => revalidatePath(path));
}
