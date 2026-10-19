import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { draftFollowUpMessage } from "@/lib/followup";

// "10.3 Follow-Up Message Drafting" + "7.4 STEP 2: JobRadar reminds the user
// and offers a drafted follow-up message."
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { channel = "email" } = await req.json().catch(() => ({}));

  const application = await db.application.findUnique({
    where: { id: params.id },
    include: { match: { include: { listing: true } } },
  });

  if (!application) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  const message = await draftFollowUpMessage({
    jobTitle: application.match.listing.title,
    company: application.match.listing.company,
    appliedAt: application.appliedAt,
    channel: channel === "linkedin" ? "linkedin" : "email",
  });

  await db.followUp.create({
    data: { applicationId: application.id, draftMessage: message, channel },
  });

  return NextResponse.json({ message });
}
