import Link from "next/link";
import { getSearchProfiles, getResumeForUser, getDemoUser } from "@/lib/queries";
import { getSessionUser } from "@/lib/auth";
import { fromJson } from "@/lib/db";
import { ProfileForm } from "./ProfileForm";
import { DeleteProfileButton } from "./DeleteProfileButton";
import { ReplaceResumeButton } from "./ReplaceResumeButton";
import { ComingSoonButton } from "@/components/ComingSoonButton";
import { canAddSearchProfile } from "@/lib/plans";
import { redirect } from "next/navigation";

export const revalidate = 30;

export default async function ProfilePage() {
  const sessionUser = await getSessionUser();
  const demoUser = await getDemoUser();
  const user = sessionUser
    ? { id: sessionUser.id, plan: sessionUser.plan }
    : demoUser
    ? { id: demoUser.id, plan: demoUser.plan }
    : null;

  if (!user) {
    redirect("/login");
  }

  const profiles = await getSearchProfiles(user.id);
  const resume = await getResumeForUser(user.id);

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

  const parsedResume = resume
    ? fromJson<{ skills: string[]; roles: string[] }>(resume.parsedJson, { skills: [], roles: [] })
    : null;

  const canAddMore = canAddSearchProfile(user.plan, profiles.length);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-5">
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
                titles: fromJson<string[]>(profile.titles, []),
                keywords: fromJson<string[]>(profile.keywords, []),
                locations: fromJson<string[]>(profile.locations, []),
                seniority: profile.seniority,
                salaryMin: profile.salaryMin,
                salaryMax: profile.salaryMax,
              }}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-card border border-border bg-surface p-5">
          <h3 className="text-[13.5px] font-bold">Résumé on file</h3>
          {resume ? (
            <>
              <div className="mt-1.5 text-[12.5px] text-ink-muted">{resume.fileUrl}</div>
              <div className="mt-0.5 text-[12px] text-ink-muted">
                {parsedResume?.skills.length ?? 0} skills · {parsedResume?.roles.length ?? 0} roles extracted
              </div>
            </>
          ) : (
            <div className="mt-1.5 text-[12.5px] text-ink-muted">No résumé uploaded yet.</div>
          )}
          <ReplaceResumeButton userId={user.id} />
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
