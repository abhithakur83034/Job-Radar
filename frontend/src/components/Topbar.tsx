"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutUser } from "@/lib/api";
import { SignOutIcon } from "./Sidebar";

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
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-bg px-4 py-3 sm:px-5 md:px-8 md:py-4">
      <div className="min-w-0">
        <h1 className="truncate font-display text-[17px] font-bold md:text-[19px]">{title}</h1>
        {sub && <div className="mt-0.5 hidden text-[12.5px] text-ink-muted sm:block">{sub}</div>}
      </div>
      <div className="flex flex-none items-center gap-2">
        <Link
          href="/onboarding"
          aria-label="New search profile"
          className="whitespace-nowrap rounded-[9px] border border-accent bg-accent px-3 py-1.5 text-[13px] font-semibold text-accent-ink hover:brightness-105 md:px-4 md:py-2"
        >
          +<span className="hidden sm:inline"> New search profile</span>
          <span className="sm:hidden"> New</span>
        </Link>
        {/* The sidebar (and its sign-out button) is hidden on phones */}
        <button
          onClick={async () => {
            await logoutUser();
            window.location.href = "/login";
          }}
          aria-label="Sign out"
          className="rounded-[9px] border border-border p-2 text-ink-muted hover:text-white md:hidden"
        >
          <SignOutIcon className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
