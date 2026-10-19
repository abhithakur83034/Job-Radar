import { db, fromJson } from "./db";

export async function getDemoUser() {
  return db.user.findFirst({ orderBy: { createdAt: "asc" } });
}

export async function getSearchProfiles() {
  const user = await getDemoUser();
  if (!user) return [];

  return db.searchProfile.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
}

export async function getMatchFeed() {
  const profiles = await getSearchProfiles();
  if (profiles.length === 0) return [];

  const matches = await db.match.findMany({
    where: { searchProfileId: { in: profiles.map((p) => p.id) } },
    include: { listing: true },
    orderBy: [{ fitScore: "desc" }, { createdAt: "desc" }],
  });

  return matches.map((m) => ({
    ...m,
    matchedSkills: fromJson<string[]>(m.matchedSkills, []),
    missingRequirements: fromJson<string[]>(m.missingRequirements, []),
  }));
}

export async function getApplications() {
  return db.application.findMany({
    include: { match: { include: { listing: true } } },
    orderBy: { appliedAt: "desc" },
  });
}

export async function getMatchWithDraft(matchId: string) {
  return db.match.findUnique({
    where: { id: matchId },
    include: { listing: true, tailoredDraft: true, application: true },
  });
}

export async function getDefaultDraftMatch() {
  const withDraft = await db.match.findFirst({
    where: { tailoredDraft: { isNot: null } },
    include: { listing: true, tailoredDraft: true, application: true },
    orderBy: { createdAt: "desc" },
  });
  if (withDraft) return withDraft;

  return db.match.findFirst({
    include: { listing: true, tailoredDraft: true, application: true },
    orderBy: { fitScore: "desc" },
  });
}

export async function getResumeForUser(userId?: string) {
  if (!userId) return null;
  return db.resume.findFirst({ where: { userId }, orderBy: { uploadedAt: "desc" } });
}
