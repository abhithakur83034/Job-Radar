import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

// "7.3 User's Apply Workflow — STEP 4: User marks the application as
// 'Applied' in JobRadar, which starts the follow-up tracking clock."
export async function POST(req: NextRequest) {
  const { matchId } = await req.json();
  if (!matchId) {
    return NextResponse.json({ error: "matchId is required." }, { status: 400 });
  }

  const application = await db.application.upsert({
    where: { matchId },
    update: {},
    create: { matchId, status: "applied" },
  });

  revalidatePath("/tracker");
  return NextResponse.json({ application });
}
