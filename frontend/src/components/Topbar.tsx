"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TITLES: Record<string, [string, string]> = {
  "/feed": ["Match Feed", "Live listings scored against your search profile"],
  "/profile": ["Search Profile", "Edit the criteria JobRadar matches new listings against"],
  "/drafts": ["Tailored Drafts", "Review AI-tailored materials before you submit"],
  "/tracker": ["Application Tracker", "Every application you've submitted, and what's overdue"],
  "/billing": ["Account & Billing", "Plan, usage, and invoice history"],
};

export function Topbar() {
  const pathname = usePathname();
  const match = Object.keys(TITLES).find((key) => pathname?.startsWith(key));
  const [title, sub] = match ? TITLES[match] : ["JobRadar", ""];

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg px-5 py-4 md:px-8">
      <div>
        <h1 className="font-display text-[19px] font-bold">{title}</h1>
        {sub && <div className="mt-0.5 text-[12.5px] text-ink-muted">{sub}</div>}
      </div>
      <Link
        href="/onboarding"
        className="whitespace-nowrap rounded-[9px] border border-accent bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink hover:brightness-105"
      >
        + New search profile
      </Link>
    </header>
  );
}
