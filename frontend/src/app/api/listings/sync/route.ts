import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getApiInternalUrl } from "@/lib/apiUrl";

const API_INTERNAL = getApiInternalUrl();

// Scanning several company boards can take tens of seconds; allow the max on Vercel Hobby
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const boardTokens: string[] = Array.isArray(body.boardTokens) ? body.boardTokens : [];

  const cookieHeader = req.headers.get("cookie") || "";

  try {
    const res = await fetch(`${API_INTERNAL}/api/v1/jobs/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ boardTokens }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err.error || "Failed to sync jobs" }, { status: res.status });
    }

    const data = await res.json();
    revalidatePath("/feed");

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to sync listings" }, { status: 500 });
  }
}
