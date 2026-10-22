import { cache } from "react";
import { cookies } from "next/headers";
import { getApiInternalUrl } from "@/lib/apiUrl";

const API_INTERNAL = getApiInternalUrl();

function getAuthHeaders() {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get("jr_session");
  return {
    Cookie: sessionCookie?.value ? `jr_session=${sessionCookie.value}` : "",
  };
}

export const getDemoUser = cache(async function getDemoUser() {
  try {
    const res = await fetch(`${API_INTERNAL}/api/v1/auth/me`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      return data.user || null;
    }
  } catch (_e) {}
  return null;
});

export async function getSearchProfiles(_userId?: string) {
  try {
    const res = await fetch(`${API_INTERNAL}/api/v1/profiles`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      return (data.profiles || []).map((p: any) => ({
        id: p._id.toString(),
        name: p.name,
        titles: p.titles || [],
        keywords: p.keywords || [],
        locations: p.locations || [],
        seniority: p.seniority,
        salaryMin: p.salaryMin,
        salaryMax: p.salaryMax,
        fitThreshold: p.fitThreshold,
        createdAt: new Date(p.createdAt),
      }));
    }
  } catch (_e) {}
  return [];
}

export async function getMatchFeed(_userId?: string) {
  try {
    const res = await fetch(`${API_INTERNAL}/api/v1/matches`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      return (data.matches || []).map((m: any) => ({
        id: m.id || m._id?.toString(),
        fitScore: m.fitScore,
        fitReason: m.fitReason,
        matchedSkills: m.matchedSkills || [],
        missingRequirements: m.missingRequirements || [],
        saved: Boolean(m.saved),
        createdAt: new Date(m.createdAt),
        listing: {
          title: m.listing?.title || "Opportunity",
          company: m.listing?.company || "Hiring Company",
          location: m.listing?.location || "Remote",
          salaryText: m.listing?.salaryText || null,
          source: m.listing?.source || "portal",
          url: m.listing?.url || "#",
          remoteType: m.listing?.remoteType || "unknown",
          postedAt: m.listing?.postedAt ? new Date(m.listing.postedAt) : null,
          foundAt: m.listing?.foundAt ? new Date(m.listing.foundAt) : new Date(),
        },
      }));
    }
  } catch (_e) {}
  return [];
}

/** Background job sources, their freshness, and display labels (GET /api/v1/job-sources). */
export async function getJobSources(): Promise<{
  sources: import("./sources").JobSourceStatus[];
  labels: import("./sources").SourceLabels;
}> {
  try {
    const res = await fetch(`${API_INTERNAL}/api/v1/job-sources`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      return {
        sources: Array.isArray(data.sources) ? data.sources : [],
        labels: data.labels && typeof data.labels === "object" ? data.labels : {},
      };
    }
  } catch (_e) {}
  return { sources: [], labels: {} };
}

export async function getApplications() {
  try {
    const res = await fetch(`${API_INTERNAL}/api/v1/applications`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      return (data.applications || []).map((a: any) => ({
        id: a.id || a._id?.toString(),
        status: a.status,
        appliedAt: new Date(a.appliedAt),
        lastUpdateAt: new Date(a.lastUpdateAt),
        notes: a.notes,
        match: a.match ? {
          id: a.match.id,
          fitScore: a.match.fitScore,
          listing: a.match.listing ? {
            title: a.match.listing.title,
            company: a.match.listing.company,
            location: a.match.listing.location,
            url: a.match.listing.url,
            salaryText: a.match.listing.salaryText,
          } : null,
        } : null,
        followUps: (a.followUps || []).map((f: any) => ({
          id: f.id,
          draftMessage: f.draftMessage,
          channel: f.channel,
          sentAt: f.sentAt ? new Date(f.sentAt) : null,
          dismissedAt: f.dismissedAt ? new Date(f.dismissedAt) : null,
        })),
      }));
    }
  } catch (_e) {}
  return [];
}

export async function getMatchWithDraft(matchId: string) {
  try {
    const res = await fetch(`${API_INTERNAL}/api/v1/matches/${matchId}`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      return data.match || null;
    }
  } catch (_e) {}
  return null;
}

export async function getDefaultDraftMatch() {
  try {
    // One call: the backend resolves "top" to the user's best match with full details
    const res = await fetch(`${API_INTERNAL}/api/v1/matches/top`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      return data.match || null;
    }
  } catch (_e) {}
  return null;
}

export async function getResumeForUser(_userId?: string) {
  try {
    const res = await fetch(`${API_INTERNAL}/api/v1/resumes/latest`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (data.resume) {
        return {
          id: data.resume._id.toString(),
          fileUrl: data.resume.fileUrl,
          fileName: data.resume.fileName || data.resume.fileUrl,
          uploadedAt: new Date(data.resume.uploadedAt || data.resume.createdAt),
          parsedData: data.resume.parsedData || { skills: [], roles: [] },
        };
      }
    }
  } catch (_e) {}
  return null;
}
