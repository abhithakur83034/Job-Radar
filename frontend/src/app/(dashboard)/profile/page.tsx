import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSearchProfiles, getResumeForUser, getDemoUser } from "@/lib/queries";
import { getSessionUser } from "@/lib/auth";
import { ProfileForm } from "./ProfileForm";
import { DeleteProfileButton } from "./DeleteProfileButton";
import { ReplaceResumeButton } from "./ReplaceResumeButton";
import { AvatarUpload } from "./AvatarUpload";
import { ViewResumeModal } from "./ViewResumeModal";
import { ComingSoonButton } from "@/components/ComingSoonButton";
import { canAddSearchProfile } from "@/lib/plans";
import { getApiInternalUrl } from "@/lib/apiUrl";

export const revalidate = 0;

interface ParsedResumeData {
  summary?: string;
  skills: string[];
  roles: string[];
  experience?: string;
}

interface LoadedResume {
  id: string;
  fileUrl: string;
  fileName: string;
  uploadedAt: Date;
  parsedData: ParsedResumeData;
}

export default async function ProfilePage() {
  const sessionUser = await getSessionUser();
  const demoUser = await getDemoUser();
  const user = sessionUser
    ? {
        id: sessionUser.id,
        name: sessionUser.name,
        email: sessionUser.email,
        plan: sessionUser.plan,
        avatarUrl: sessionUser.avatarUrl,
      }
    : demoUser
    ? {
        id: demoUser.id,
        name: demoUser.name,
        email: demoUser.email,
        plan: demoUser.plan,
        avatarUrl: demoUser.avatarUrl,
      }
    : null;

  if (!user) {
    redirect("/login");
  }

  const cookieStore = cookies();
  const sessionCookie = cookieStore.get("jr_session");
  const API_INTERNAL = getApiInternalUrl();

  // 1. Fetch search profiles from MongoDB via Express API
  let profiles: {
    id: string;
    name: string;
    titles: string[];
    keywords: string[];
    locations: string[];
    seniority: string;
    salaryMin: number | null;
    salaryMax: number | null;
    fitThreshold?: number;
  }[] = [];

  if (sessionCookie?.value) {
    try {
      const res = await fetch(`${API_INTERNAL}/api/v1/profiles`, {
        headers: {
          Cookie: `jr_session=${sessionCookie.value}`,
        },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.profiles) && data.profiles.length > 0) {
          profiles = data.profiles.map((p: any) => ({
            id: String(p._id),
            name: p.name || p.titles?.[0] || "Search Profile",
            titles: Array.isArray(p.titles) ? p.titles : [],
            keywords: Array.isArray(p.keywords) ? p.keywords : [],
            locations: Array.isArray(p.locations) ? p.locations : [],
            seniority: p.seniority || "senior",
            salaryMin: p.salaryMin ?? null,
            salaryMax: p.salaryMax ?? null,
            fitThreshold: p.fitThreshold ?? 65,
          }));
        }
      }
    } catch (_err) {
      // Handled
    }
  }

  // 2. Fetch latest resume from MongoDB via Express API
  let resume: LoadedResume | null = null;

  if (sessionCookie?.value) {
    try {
      const res = await fetch(`${API_INTERNAL}/api/v1/resumes/latest`, {
        headers: {
          Cookie: `jr_session=${sessionCookie.value}`,
        },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.resume) {
          resume = {
            id: String(data.resume._id),
            fileUrl: data.resume.fileUrl,
            fileName: data.resume.fileName || data.resume.fileUrl,
            uploadedAt: new Date(data.resume.uploadedAt || data.resume.createdAt),
            parsedData: data.resume.parsedData || { skills: [], roles: [] },
          };
        }
      }
    } catch (_err) {
      // Handled
    }
  }

  if (profiles.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border p-8 text-center text-ink-muted">
        No search profile configured yet — complete{" "}
        <Link href="/onboarding" className="text-accent-soft-ink underline">
          onboarding
        </Link>{" "}
        to set your target roles, locations, and seniority.
      </div>
    );
  }

  const canAddMore = canAddSearchProfile(user.plan, profiles.length);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-5">
        {/* Candidate Profile Photo & Identity */}
        <div className="rounded-card border border-border bg-surface p-6">
          <AvatarUpload
            userId={user.id}
            userName={user.name}
            initialAvatarUrl={user.avatarUrl}
          />
        </div>

        {profiles.map((profile) => (
          <div key={profile.id} className="rounded-card border border-border bg-surface p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold">{profile.name}</h2>
                <p className="mt-0.5 text-[12.5px] text-ink-muted">
                  This profile drives every match score and notification you receive.
                </p>
              </div>
              {profiles.length > 1 && <DeleteProfileButton profileId={profile.id} />}
            </div>
            <ProfileForm
              profileId={profile.id}
              initial={{
                titles: Array.isArray(profile.titles) ? profile.titles : [],
                keywords: Array.isArray(profile.keywords) ? profile.keywords : [],
                locations: Array.isArray(profile.locations) ? profile.locations : [],
                seniority: profile.seniority,
                salaryMin: profile.salaryMin,
                salaryMax: profile.salaryMax,
              }}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {/* Résumé on file Card */}
        <div className="rounded-card border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[13.5px] font-bold">Résumé on file</h3>
            {resume && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] font-semibold text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                Active & Parsed
              </span>
            )}
          </div>

          {resume ? (
            <div className="mt-4 space-y-4">
              {/* File Info Box with View and Download Actions */}
              <div className="rounded-xl border border-border bg-bg/60 p-3.5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-accent/15 text-accent font-bold text-[13px]">
                    PDF
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-[13.5px] text-ink">
                      {resume.fileName || resume.fileUrl}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-ink-muted">
                      Uploaded{" "}
                      {new Date(resume.uploadedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                </div>

                {/* Direct Action Buttons to view or download */}
                <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-2.5">
                  <ViewResumeModal
                    fileName={resume.fileName || resume.fileUrl}
                    resumeUrl="/api/v1/resumes/view/latest"
                  />
                  <a
                    href="/api/v1/resumes/download/latest"
                    download={resume.fileName || "resume.pdf"}
                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-border bg-surface-2 px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:border-accent hover:text-accent-soft-ink"
                    title="Download résumé file"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      className="h-3.5 w-3.5 text-ink-muted"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    Download
                  </a>
                </div>
              </div>

              {/* Extracted Skills Chips */}
              {resume.parsedData?.skills && resume.parsedData.skills.length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    Extracted Skills ({resume.parsedData.skills.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {resume.parsedData.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-md border border-border bg-surface-2 px-2 py-0.5 text-[11.5px] font-medium text-ink"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Roles / Summary Preview */}
              {resume.parsedData?.roles && resume.parsedData.roles.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    Target Roles
                  </div>
                  <div className="text-[12.5px] text-ink-muted">
                    {resume.parsedData.roles.join(" · ")}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-border bg-bg/40 p-5 text-center">
              <div className="text-[13px] font-semibold text-ink">No résumé uploaded yet</div>
              <p className="mt-1 text-[11.5px] text-ink-muted">
                Upload your résumé to automatically extract skills and power high-accuracy job matching.
              </p>
            </div>
          )}

          <ReplaceResumeButton userId={user.id} hasResume={Boolean(resume)} />
        </div>

        {canAddMore ? (
          <Link
            href="/onboarding"
            className="block rounded-card border border-dashed border-border p-5 text-center text-ink-muted hover:border-accent hover:text-accent-soft-ink"
          >
            <div className="text-[12.5px] font-semibold">+ Add another search profile</div>
            <div className="mt-1 text-[12px]">Run a parallel search for a different role or location</div>
          </Link>
        ) : (
          <div className="rounded-card border border-dashed border-border p-5 text-center text-ink-muted">
            <div className="text-[12.5px] font-semibold">Additional search profiles</div>
            <div className="mt-1 text-[12px]">Run parallel searches for different roles on Career Boost</div>
            <ComingSoonButton
              note="Billing isn't wired up yet in this build — Stripe integration is Phase 6 of the build plan."
              className="mt-2.5 rounded-[9px] border border-border px-3 py-1.5 text-[12px] font-semibold"
            >
              Upgrade to unlock
            </ComingSoonButton>
          </div>
        )}
      </div>
    </div>
  );
}
