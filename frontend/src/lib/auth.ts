import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getApiInternalUrl } from "@/lib/apiUrl";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  username: string | null;
  mobile: string | null;
  role: string;
  plan: string;
  avatarUrl: string | null;
  unreadNotifications: number;
}

const API_INTERNAL = getApiInternalUrl();

export const API_UNAVAILABLE_MESSAGE =
  "We couldn't reach the JobRadar server. It may be starting up. Please try again in a moment.";

/** The API was unreachable or erroring: not the same as being signed out. */
export class ApiUnavailableError extends Error {
  constructor() {
    super(API_UNAVAILABLE_MESSAGE);
    this.name = "ApiUnavailableError";
  }
}

export const getSessionUser = cache(async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get("jr_session");

  if (!sessionCookie?.value) {
    return null;
  }

  // Only a 401/403 from the API means "signed out". A network error or 5xx (API
  // restarting, Render waking up) is retried once, then reported as an outage, so a
  // signed-in user is never bounced to /login just because the API was briefly down.
  let res: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await fetch(`${API_INTERNAL}/api/v1/auth/me`, {
        headers: { Cookie: `jr_session=${sessionCookie.value}` },
        cache: "no-store",
      });
      if (res.status < 500) break;
    } catch {
      res = null;
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
  }

  if (!res || res.status >= 500) throw new ApiUnavailableError();
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new ApiUnavailableError();

  const data = await res.json().catch(() => null);
  if (!data?.user) return null;

  return {
    id: data.user.id,
    name: data.user.name,
    email: data.user.email,
    username: data.user.username ?? null,
    mobile: data.user.mobile ?? null,
    role: data.user.role,
    plan: "free",
    avatarUrl: data.user.avatarUrl || null,
    unreadNotifications: data.user.unreadNotifications ?? 0,
  };
});

export async function requireAuthUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

