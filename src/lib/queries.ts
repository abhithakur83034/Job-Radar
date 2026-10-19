import { db, fromJson } from "./db";

// Single-tenant demo: JobRadar has no auth layer yet (Phase 6 in the build
// plan bundles billing + real accounts). Every query in this MVP scaffold
// operates against one seeded demo user so the UI has real data to render.
export async function getDemoUser() {
  const user = await db.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) {
    throw new Error(
      "No user found — run `npm run db:seed` to create the demo account and sample data."
    );
  }
  return user;
}

// All of the user's search profiles, oldest first. Free plan is limited to
// one (enforced in the onboarding action), but paid plans can have several
// per "8.5 Search Profile Settings — manage multiple search profiles."
export async function getSearchProfiles() {
  const user = await getDemoUser();
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
  const applications = await db.application.findMany({
    include: { match: { include: { listing: true } } },
    orderBy: { appliedAt: "desc" },
  });
  return applications;
}

export async function getMatchWithDraft(matchId: string) {
  return db.match.findUnique({
    where: { id: matchId },
    include: { listing: true, tailoredDraft: true, application: true },
  });
}

// For the Tailored Drafts screen when no specific match is requested: prefer
// the most recent match that already has a draft, otherwise the top-scoring
// match overall.
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

export async function getResumeForUser(userId: string) {
  return db.resume.findFirst({ where: { userId }, orderBy: { uploadedAt: "desc" } });
}
