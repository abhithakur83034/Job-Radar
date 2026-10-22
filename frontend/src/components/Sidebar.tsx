"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logoutUser } from "@/lib/api";

const NAV_ITEMS = [
  {
    href: "/feed",
    label: "Match Feed",
    shortLabel: "Feed",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 12L18 7" />
      </>
    ),
  },
  {
    href: "/profile",
    label: "Search Profile",
    shortLabel: "Profile",
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
        <path d="M12 3.5V6M12 18v2.5M3.5 12H6M18 12h2.5" />
      </>
    ),
  },
  {
    href: "/drafts",
    label: "Tailored Drafts",
    shortLabel: "Drafts",
    icon: (
      <>
        <path d="M7 3h7l4 4v14H7z" />
        <path d="M14 3v4h4" />
        <path d="M9.5 13.5l1.7 1.7 4-4" />
      </>
    ),
  },
  {
    href: "/tracker",
    label: "Application Tracker",
    shortLabel: "Tracker",
    icon: (
      <>
        <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
        <path d="M3.5 9.5h17M8 4.5v-1M16 4.5v-1" />
      </>
    ),
  },
  {
    href: "/billing",
    label: "Account & Billing",
    shortLabel: "Account",
    icon: (
      <>
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 10.5h18M7 15h4" />
      </>
    ),
  },
];

const PLAN_LABELS: Record<string, string> = {
  free: "FREE PLAN",
  active_search: "ACTIVE SEARCH",
  career_boost: "CAREER BOOST",
};

export function Sidebar({
  name,
  plan = "free",
  avatarUrl,
}: {
  name: string;
  plan?: string | null;
  avatarUrl: string | null;
}) {
  const pathname = usePathname();
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="sticky top-0 hidden h-screen w-[76px] flex-none flex-col bg-sidebar p-3 md:flex lg:w-[236px] lg:p-4">
      <div className="flex items-center justify-center gap-2.5 px-1 pb-5 lg:justify-start lg:px-2">
        <span className="h-2.5 w-2.5 flex-none rounded-full bg-accent shadow-[0_0_0_4px_var(--accent-soft)]" />
        <span className="hidden font-display text-[17px] font-bold tracking-tight text-white lg:inline">
          JobRadar
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex items-center justify-center gap-2.5 rounded-[10px] border-l-[3px] px-3 py-2.5 text-[13.5px] font-medium lg:justify-start ${
                active
                  ? "border-accent bg-sidebar-hover text-white"
                  : "border-transparent text-sidebar-ink hover:bg-sidebar-hover hover:text-white"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className={`h-[18px] w-[18px] flex-none ${active ? "text-accent" : ""}`}
              >
                {item.icon}
              </svg>
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3.5">
        <Link href="/billing" className="flex items-center gap-2.5 hover:opacity-90">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" loading="lazy" decoding="async" className="h-8 w-8 flex-none rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent font-display text-[12.5px] font-bold text-accent-ink">
              {initials || "?"}
            </div>
          )}
          <div className="hidden min-w-0 lg:block">
            <div className="truncate text-[13px] font-semibold text-white">{name}</div>
            <span className="mt-0.5 inline-block rounded-full bg-accent px-1.5 py-0.5 text-[9.5px] font-bold tracking-wide text-accent-ink">
              {(plan && PLAN_LABELS[plan]) ? PLAN_LABELS[plan] : (plan ? plan.toUpperCase() : "FREE PLAN")}
            </span>
          </div>
        </Link>
        <button
          onClick={async (e) => {
            e.preventDefault();
            await logoutUser();
            window.location.href = "/login";
          }}
          title="Sign out"
          className="hidden text-sidebar-ink hover:text-white lg:block p-1 rounded hover:bg-sidebar-hover transition"
        >
          <SignOutIcon className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}

export function SignOutIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/** Bottom tab bar shown below the md breakpoint, replacing the sidebar on phones. */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[10.5px] font-semibold ${
                  active ? "text-accent" : "text-sidebar-ink active:text-white"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[22px] w-[22px]">
                  {item.icon}
                </svg>
                {item.shortLabel}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
