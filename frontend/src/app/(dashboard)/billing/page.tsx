import { db } from "@/lib/db";
import { getDemoUser } from "@/lib/queries";
import { getSessionUser } from "@/lib/auth";
import { ComingSoonButton } from "@/components/ComingSoonButton";
import { AccountDetailsCard } from "./AccountDetailsCard";
import { FREE_PROFILE_LIMIT } from "@/lib/plans";
import { redirect } from "next/navigation";

// Cached and revalidated on-demand via revalidatePath() in server actions
// (see ./actions.ts), with a 30s time-based fallback so nothing goes stale
// for long even after a mutation from an API route rather than an action.
export const revalidate = 30;

const PLANS = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    features: [`${FREE_PROFILE_LIMIT} search profiles`, "Daily digest notifications", "3 tailored résumés / month"],
  },
  {
    key: "active_search",
    name: "Active Search",
    price: "$18",
    features: ["Unlimited tailored résumés & cover letters", "Real-time alerts", "Follow-up tracker"],
  },
  {
    key: "career_boost",
    name: "Career Boost",
    price: "$30",
    features: ["Everything in Active Search", "Multiple search profiles", "Priority matching & résumé tips"],
  },
];

const FREE_MONTHLY_LIMIT = 3;

export default async function BillingPage() {
  const sessionUser = await getSessionUser();
  const demoUser = await getDemoUser();

  const user = sessionUser
    ? {
        id: sessionUser.id,
        name: sessionUser.name,
        email: sessionUser.email,
        plan: sessionUser.plan,
        avatarUrl: sessionUser.avatarUrl,
        createdAt: new Date(),
      }
    : demoUser;

  if (!user) {
    redirect("/login");
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const draftsThisMonth = await db.tailoredDraft.count({
    where: {
      createdAt: { gte: startOfMonth },
      match: { searchProfile: { userId: user.id } },
    },
  });

  const isFree = user.plan === "free";
  const usagePct = isFree ? Math.min(100, (draftsThisMonth / FREE_MONTHLY_LIMIT) * 100) : 0;

  return (
    <div>
      <div className="mb-5">
        <AccountDetailsCard
          userId={user.id}
          initialName={user.name}
          email={user.email}
          plan={user.plan}
          avatarUrl={user.avatarUrl}
          memberSince={user.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        />
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-5 rounded-card border border-border bg-surface p-5">
        <div className="min-w-[220px] flex-1">
          <div className="text-[14px] font-bold">
            You&apos;re on the {PLANS.find((p) => p.key === user.plan)?.name ?? user.plan} plan
          </div>
          {isFree ? (
            <>
              <div className="mb-2.5 mt-1 text-[12.5px] text-ink-muted">
                Tailored résumés generated this month
              </div>
              <div className="mono text-[15px] font-bold">
                {draftsThisMonth}{" "}
                <span className="font-body text-[12px] font-medium text-ink-muted">
                  of {FREE_MONTHLY_LIMIT} used
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-accent" style={{ width: `${usagePct}%` }} />
              </div>
            </>
          ) : (
            <div className="mt-1 text-[12.5px] text-ink-muted">Unlimited tailored résumés this month.</div>
          )}
        </div>
        <ComingSoonButton
          note="Billing isn't wired up yet in this build — Stripe integration is Phase 6 of the build plan."
          className="rounded-[9px] bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink"
        >
          Upgrade plan
        </ComingSoonButton>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const current = plan.key === user.plan;
          return (
            <div
              key={plan.key}
              className={`flex flex-col gap-2.5 rounded-card border bg-surface p-6 ${
                current ? "border-accent shadow-[0_0_0_1px_var(--accent)]" : "border-border"
              }`}
            >
              <div className="text-[15px] font-bold">{plan.name}</div>
              <div className="mono text-2xl font-bold">
                {plan.price}
                <span className="font-body text-[12px] font-medium text-ink-muted">/mo</span>
              </div>
              <ul className="flex flex-col gap-1.5 text-[12.5px] text-ink-muted">
                {plan.features.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              {current ? (
                <button
                  disabled
                  className="mt-1 cursor-not-allowed rounded-[9px] border border-border px-3 py-1.5 text-[12px] font-semibold opacity-60"
                >
                  Current plan
                </button>
              ) : (
                <ComingSoonButton
                  note="Billing isn't wired up yet in this build — Stripe integration is Phase 6 of the build plan."
                  className="mt-1 rounded-[9px] bg-sidebar px-3 py-1.5 text-[12px] font-semibold text-white"
                >
                  Upgrade
                </ComingSoonButton>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-card border border-border bg-surface p-5">
        <div className="text-[13.5px] font-bold">Invoice history</div>
        <div className="mt-1 text-[12.5px] text-ink-muted">
          {isFree
            ? "No invoices yet — upgrade to a paid plan to see billing history here."
            : "Stripe billing integration lands in build Phase 6 — invoices will appear here once wired up."}
        </div>
      </div>
    </div>
  );
}
