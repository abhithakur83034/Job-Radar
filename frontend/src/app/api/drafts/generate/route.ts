import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getApiInternalUrl } from "@/lib/apiUrl";

const API_INTERNAL = getApiInternalUrl();

export async function POST(req: NextRequest) {
  const { matchId } = await req.json().catch(() => ({}));
  if (!matchId) {
    return NextResponse.json({ error: "matchId is required." }, { status: 400 });
  }

  const cookieHeader = req.headers.get("cookie") || "";

  try {
    const res = await fetch(`${API_INTERNAL}/api/v1/drafts/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ matchId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err.error || "Failed to generate draft" }, { status: res.status });
    }

    const data = await res.json();
    revalidatePath("/drafts");
    revalidatePath("/billing");

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to generate draft" }, { status: 500 });
  }
}
