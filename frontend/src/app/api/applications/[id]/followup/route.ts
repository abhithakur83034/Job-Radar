import { NextRequest, NextResponse } from "next/server";
import { getApiInternalUrl } from "@/lib/apiUrl";

const API_INTERNAL = getApiInternalUrl();

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { channel = "email", draftMessage } = await req.json().catch(() => ({}));
  const cookieHeader = req.headers.get("cookie") || "";

  try {
    const res = await fetch(`${API_INTERNAL}/api/v1/applications/${params.id}/followup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ channel, draftMessage }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err.error || "Failed to create follow-up" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create follow-up" }, { status: 500 });
  }
}
