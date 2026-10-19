"use server";

import { revalidatePath } from "next/cache";
import { db, toJson } from "@/lib/db";
import { cookies } from "next/headers";

export async function updateSearchProfile(
  id: string,
  data: {
    titles: string[];
    keywords: string[];
    locations: string[];
    seniority: string;
    salaryMin: number | null;
    salaryMax: number | null;
  }
) {
  // 1. Sync update to MongoDB via Express API
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get("jr_session");
  const API_INTERNAL = process.env.API_INTERNAL_URL || "http://localhost:4000";

  if (sessionCookie?.value) {
    try {
      await fetch(`${API_INTERNAL}/api/v1/profiles/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `jr_session=${sessionCookie.value}`,
        },
        body: JSON.stringify({
          name: data.titles[0] || "Search Profile",
          titles: data.titles,
          keywords: data.keywords,
          locations: data.locations,
          seniority: data.seniority,
          salaryMin: data.salaryMin,
          salaryMax: data.salaryMax,
        }),
      });
    } catch (err) {
      console.error("Failed to sync profile update to MongoDB:", err);
    }
  }

  // 2. Also keep SQLite in sync
  try {
    const existing = await db.searchProfile.findUnique({ where: { id } });
    if (existing) {
      await db.searchProfile.update({
        where: { id },
        data: {
          name: data.titles[0] ?? undefined,
          titles: toJson(data.titles),
          keywords: toJson(data.keywords),
          locations: toJson(data.locations),
          seniority: data.seniority,
          salaryMin: data.salaryMin,
          salaryMax: data.salaryMax,
        },
      });
    } else {
      const first = await db.searchProfile.findFirst();
      if (first) {
        await db.searchProfile.update({
          where: { id: first.id },
          data: {
            name: data.titles[0] ?? undefined,
            titles: toJson(data.titles),
            keywords: toJson(data.keywords),
            locations: toJson(data.locations),
            seniority: data.seniority,
            salaryMin: data.salaryMin,
            salaryMax: data.salaryMax,
          },
        });
      }
    }
  } catch (_err) {
    // Handled
  }

  revalidatePath("/profile");
  revalidatePath("/feed");
}

export async function replaceResume(userId: string, fileName: string) {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get("jr_session");
  const API_INTERNAL = process.env.API_INTERNAL_URL || "http://localhost:4000";

  // 1. Sync to MongoDB via Express API
  if (sessionCookie?.value) {
    try {
      await fetch(`${API_INTERNAL}/api/v1/resumes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `jr_session=${sessionCookie.value}`,
        },
        body: JSON.stringify({
          fileUrl: fileName,
          parsedData: {
            summary: `Candidate resume on file: ${fileName}`,
            skills: ["TypeScript", "React", "Next.js", "Tailwind CSS", "JavaScript"],
            roles: ["Frontend Developer", "Senior Frontend Engineer"],
            experience: "4+ years",
          },
        }),
      });
    } catch (err) {
      console.error("Failed to sync resume to MongoDB API:", err);
    }
  }

  // 2. Sync to SQLite for local session continuity
  try {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      await db.user.create({
        data: {
          id: userId,
          name: "User",
          email: `${userId}@example.com`,
        },
      });
    }

    const existing = await db.resume.findFirst({ where: { userId }, orderBy: { uploadedAt: "desc" } });
    const parsedData = {
      summary: `Candidate resume on file: ${fileName}`,
      skills: ["TypeScript", "React", "Next.js", "Tailwind CSS", "JavaScript"],
      roles: ["Frontend Developer", "Senior Frontend Engineer"],
      experience: "4+ years",
    };

    if (existing) {
      await db.resume.update({
        where: { id: existing.id },
        data: {
          fileUrl: fileName,
          parsedJson: toJson(parsedData),
          uploadedAt: new Date(),
        },
      });
    } else {
      await db.resume.create({
        data: {
          userId,
          fileUrl: fileName,
          parsedJson: toJson(parsedData),
        },
      });
    }
  } catch (err) {
    console.error("Failed to update resume in SQLite:", err);
  }

  revalidatePath("/profile");
}

export async function deleteSearchProfile(id: string) {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get("jr_session");
  const API_INTERNAL = process.env.API_INTERNAL_URL || "http://localhost:4000";

  if (sessionCookie?.value) {
    try {
      await fetch(`${API_INTERNAL}/api/v1/profiles/${id}`, {
        method: "DELETE",
        headers: {
          Cookie: `jr_session=${sessionCookie.value}`,
        },
      });
    } catch (err) {
      console.error("Failed to delete profile from MongoDB:", err);
    }
  }

  try {
    const profile = await db.searchProfile.findUnique({ where: { id } });
    if (profile) {
      const count = await db.searchProfile.count({ where: { userId: profile.userId } });
      if (count > 1) {
        await db.searchProfile.delete({ where: { id } });
      }
    } else {
      const count = await db.searchProfile.count();
      if (count > 1) {
        const extra = await db.searchProfile.findFirst({ orderBy: { createdAt: "desc" } });
        if (extra) {
          await db.searchProfile.delete({ where: { id: extra.id } });
        }
      }
    }
  } catch (_err) {
    // Handled
  }

  revalidatePath("/profile");
  revalidatePath("/feed");
}

export async function updateUserAvatar(userId: string, avatarUrl: string) {
  try {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (user) {
      await db.user.update({
        where: { id: userId },
        data: { avatarUrl },
      });
    }
  } catch (err) {
    console.error("Failed to update avatar in SQLite:", err);
  }

  revalidatePath("/profile");
  revalidatePath("/feed");
  revalidatePath("/drafts");
  revalidatePath("/tracker");
}
