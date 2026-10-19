"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

const DASHBOARD_PATHS = ["/feed", "/profile", "/drafts", "/tracker", "/billing"];

export async function updateAccountDetails(userId: string, data: { name?: string; avatarUrl?: string }) {
  await db.user.update({ where: { id: userId }, data });
  // The sidebar (name + avatar) renders on every dashboard page via the
  // shared layout, so all of them need to pick up the change.
  DASHBOARD_PATHS.forEach((path) => revalidatePath(path));
}
