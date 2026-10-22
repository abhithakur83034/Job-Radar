"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getApiInternalUrl } from "@/lib/apiUrl";

const DASHBOARD_PATHS = ["/feed", "/profile", "/drafts", "/tracker", "/billing"];
const API_INTERNAL = getApiInternalUrl();

export interface AccountUpdate {
  name?: string;
  username?: string;
  mobile?: string;
}

export type AccountUpdateResult = { ok: true } | { ok: false; error: string };

export async function updateAccountDetails(data: AccountUpdate): Promise<AccountUpdateResult> {
  const sessionCookie = cookies().get("jr_session");

  try {
    const res = await fetch(`${API_INTERNAL}/api/v1/auth/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie?.value ? `jr_session=${sessionCookie.value}` : "",
      },
      body: JSON.stringify(data),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error || `Couldn't save your details (HTTP ${res.status})` };
    }
  } catch {
    return { ok: false, error: "Couldn't reach the server. Please try again." };
  }

  DASHBOARD_PATHS.forEach((path) => revalidatePath(path));
  return { ok: true };
}

/** After an avatar upload (which updates the user directly), refresh pages that show it. */
export async function revalidateDashboard() {
  DASHBOARD_PATHS.forEach((path) => revalidatePath(path));
}
