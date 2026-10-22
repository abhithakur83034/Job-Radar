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
}

const API_INTERNAL = getApiInternalUrl();

export const getSessionUser = cache(async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get("jr_session");

  if (!sessionCookie?.value) {
    return null;
  }

  try {
    const res = await fetch(`${API_INTERNAL}/api/v1/auth/me`, {
      headers: {
        Cookie: `jr_session=${sessionCookie.value}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (!data.user) return null;

    return {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      username: data.user.username ?? null,
      mobile: data.user.mobile ?? null,
      role: data.user.role,
      plan: "free",
      avatarUrl: data.user.avatarUrl || null,
    };
  } catch (_err) {
    return null;
  }
});

export async function requireAuthUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

