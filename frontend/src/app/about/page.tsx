import Link from "next/link";
import type { Metadata } from "next";
import { getApiInternalUrl } from "@/lib/apiUrl";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "About · JobRadar",
  description: "How JobRadar finds, scores and tracks job openings for you.",
};

// Refresh the credited source list every few minutes
export const revalidate = 300;

interface PublicSource {
  id: string;
  name: string;
  homepage: string;
}

async function getSources(): Promise<PublicSource[]> {
  try {
    const res = await fetch(`${getApiInternalUrl()}/api/v1/job-sources/public`, { next: { revalidate: 300 } });
    if (res.ok) return (await res.json()).sources ?? [];
  } catch {
    // The rest of the page doesn't depend on this list
  }
  return [];
}

const STEPS = [
  {
    title: "Tell it what you want",
    body: "Upload your résumé and set target roles, skills, locations and seniority. JobRadar reads your skills and experience from the file itself.",
  },
  {
    title: "It watches job sources for you",
    body: "Every hour it checks the company job boards you follow plus public remote-job feeds, and hides jobs once they close.",
  },
  {
    title: "You get scored matches",
    body: "Each opening is scored on title, skills, location and level. Strong new matches appear in your feed and can trigger an alert.",
  },
  {
    title: "Apply and track",
    body: "Open the original posting to apply, draft tailored materials, and track every application and follow-up in one place.",
  },
];

const PRINCIPLES = [
  "JobRadar never asks for your LinkedIn, Naukri or Indeed passwords, and never scrapes those sites. Their jobs can reach you through your own job-alert emails if you connect Gmail (read-only, alert emails only).",
  "Applications always happen on the employer's or source's own site. Every listing links back to where it came from.",
  "Your résumé file stays private to your account and is only used to score matches for you.",
  "Job descriptions are stored as plain text, and closed or removed jobs are hidden from feeds.",
];

export default async function AboutPage() {
  const sources = await getSources();

  return (
    <div className="min-h-screen bg-bg">
      <header className="mx-auto flex max-w-[960px] items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-display text-[17px] font-bold text-ink">
          <span className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_0_4px_var(--accent-soft)]" />
          JobRadar
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/feed" className="rounded-[9px] bg-accent px-3.5 py-2 text-[13px] font-semibold text-accent-ink hover:brightness-105">
            Open app
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[960px] px-4 pb-16 sm:px-6">
        <section className="py-8 sm:py-12">
          <h1 className="max-w-[640px] text-balance font-display text-[30px] font-bold leading-tight text-ink sm:text-[40px]">
            Your personal radar for new job openings
          </h1>
          <p className="mt-4 max-w-[620px] text-[15px] leading-relaxed text-ink-muted">
            JobRadar watches company job boards and public job feeds, scores every new opening against your résumé and
            preferences, and shows you only the ones worth your time — so you hear about the right roles early, without
            refreshing a dozen sites.
          </p>
        </section>

        <section aria-labelledby="how-heading" className="py-6">
          <h2 id="how-heading" className="font-display text-[20px] font-bold text-ink">How it works</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-card border border-border bg-surface p-5">
                <div className="mono text-[12px] font-bold text-accent">0{i + 1}</div>
                <h3 className="mt-1 text-[15px] font-bold text-ink">{step.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="sources-heading" className="py-6">
          <h2 id="sources-heading" className="font-display text-[20px] font-bold text-ink">Where the jobs come from</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-card border border-border bg-surface p-5">
              <h3 className="text-[14px] font-bold text-ink">Company job boards</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
                Openings published directly by employers on Greenhouse, Lever and Ashby. You choose which companies to follow.
              </p>
            </div>
            <div className="rounded-card border border-border bg-surface p-5">
              <h3 className="text-[14px] font-bold text-ink">Public job feeds</h3>
              {sources.length ? (
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
                  Listings courtesy of{" "}
                  {sources.map((s, i) => (
                    <span key={s.id}>
                      {i > 0 && (i === sources.length - 1 ? " and " : ", ")}
                      <a href={s.homepage} target="_blank" rel="noopener" className="font-semibold text-accent hover:underline">
                        {s.name}
                      </a>
                    </span>
                  ))}
                  , used under each source&apos;s terms.
                </p>
              ) : (
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">Remote-job feeds used under each source&apos;s terms.</p>
              )}
            </div>
            <div className="rounded-card border border-border bg-surface p-5">
              <h3 className="text-[14px] font-bold text-ink">Your job-alert emails</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
                Optionally connect Gmail so alerts you already get from LinkedIn, Naukri or Indeed are added to your feed.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="privacy-heading" className="py-6">
          <h2 id="privacy-heading" className="font-display text-[20px] font-bold text-ink">How we handle your data</h2>
          <ul className="mt-4 space-y-2.5">
            {PRINCIPLES.map((p) => (
              <li key={p} className="flex gap-3 rounded-card border border-border bg-surface p-4 text-[13px] leading-relaxed text-ink-muted">
                <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                {p}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 flex flex-col items-start gap-3 rounded-card bg-gradient-to-br from-sidebar to-sidebar-top p-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-display text-[18px] font-bold">Ready to start?</div>
            <div className="mt-0.5 text-[13px] text-sidebar-ink">Create a free account and set up your first search profile in a few minutes.</div>
          </div>
          <div className="flex gap-2">
            <Link href="/register" className="rounded-[9px] bg-accent px-4 py-2 text-[13px] font-bold text-accent-ink hover:brightness-105">
              Create account
            </Link>
            <Link href="/login" className="rounded-[9px] border border-white/20 px-4 py-2 text-[13px] font-semibold hover:bg-white/10">
              Sign in
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
