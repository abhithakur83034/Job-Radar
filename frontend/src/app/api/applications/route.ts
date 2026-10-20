import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getApiInternalUrl } from "@/lib/apiUrl";

const API_INTERNAL = getApiInternalUrl();

export async function POST(req: NextRequest) {
  const { matchId, jobId, notes } = await req.json().catch(() => ({}));
  if (!matchId && !jobId) {
    return NextResponse.json({ error: "matchId or jobId is required." }, { status: 400 });
  }

  const cookieHeader = req.headers.get("cookie") || "";

  try {
    const res = await fetch(`${API_INTERNAL}/api/v1/applications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ matchId, jobId, notes, status: "applied" }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err.error || "Failed to log application" }, { status: res.status });
    }

    const data = await res.json();
    revalidatePath("/tracker");
    revalidatePath("/drafts");

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create application" }, { status: 500 });
  }
}
