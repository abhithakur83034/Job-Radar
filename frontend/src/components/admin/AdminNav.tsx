"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutUser } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/sources", label: "Job sources" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav({ name, username }: { name: string; username: string | null }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname?.startsWith(href));

  return (
    <>
      {/* Desktop: sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[220px] flex-none flex-col bg-sidebar p-4 md:flex">
        <div className="px-2 pb-1 font-display text-[16px] font-bold text-white">JobRadar</div>
        <div className="px-2 pb-5 text-[11px] font-bold uppercase tracking-wider text-accent">Admin</div>
        <nav aria-label="Admin" className="flex flex-1 flex-col gap-0.5">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={`rounded-[10px] border-l-[3px] px-3 py-2 text-[13px] font-medium ${
                isActive(l.href) ? "border-accent bg-sidebar-hover text-white" : "border-transparent text-sidebar-ink hover:bg-sidebar-hover hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="mt-3 border-t border-white/10 pt-3 text-[12px] text-sidebar-ink">
          <div className="mb-3">
            <ThemeToggle tone="sidebar" />
          </div>
          <div className="truncate font-semibold text-white">{name}</div>
          {username && <div className="truncate">@{username}</div>}
          <div className="mt-2 flex items-center justify-between">
            <Link href="/feed" className="hover:text-white">← Back to app</Link>
            <button
              type="button"
              onClick={async () => {
                await logoutUser();
                window.location.href = "/login";
              }}
              className="hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Phones: horizontally scrollable tabs */}
      <header className="sticky top-0 z-20 border-b border-border bg-sidebar md:hidden">
        <div className="flex items-center justify-between px-4 pt-3 text-[13px]">
          <span className="font-display font-bold text-white">
            JobRadar <span className="text-accent">Admin</span>
          </span>
          <div className="flex items-center gap-3">
            <ThemeToggle tone="sidebar" />
            <Link href="/feed" className="text-sidebar-ink hover:text-white">← App</Link>
          </div>
        </div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 py-2">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${
                isActive(l.href) ? "bg-accent text-accent-ink" : "text-sidebar-ink"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}
