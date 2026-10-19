"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function markFollowUpSent(applicationId: string) {
  await db.application.update({
    where: { id: applicationId },
    data: { lastUpdateAt: new Date() },
  });
  revalidatePath("/tracker");
}

export async function markApplicationStatus(applicationId: string, status: string) {
  await db.application.update({
    where: { id: applicationId },
    data: { status, lastUpdateAt: new Date() },
  });
  revalidatePath("/tracker");
}
