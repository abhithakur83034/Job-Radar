"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MatchCard, type MatchCardData } from "./MatchCard";
import { isRemote } from "@/lib/format";
import { sourceLabel, type SourceLabels } from "@/lib/sources";

type Filter = "all" | "fit80" | "remote" | "saved";

// Cards are rendered in pages as the user scrolls, instead of all at once
const PAGE_SIZE = 20;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All matches" },
  { key: "fit80", label: "Fit > 80%" },
  { key: "remote", label: "Remote" },
  { key: "saved", label: "Saved" },
];

export function MatchFeedClient({ matches, labels }: { matches: MatchCardData[]; labels?: SourceLabels }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [source, setSource] = useState("all");
  const [shown, setShown] = useState(PAGE_SIZE);
  // "Not interested": removed locally right away; the server keeps them hidden for good
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [hiddenCompanies, setHiddenCompanies] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<{ label: string; revert: () => Promise<void> } | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Only offer sources that actually have matches, with counts
  const sourceOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of matches) counts.set(m.listing.source, (counts.get(m.listing.source) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [matches]);

  const visible = useMemo(() => {
    return matches.filter((m) => {
      if (dismissedIds.has(m.id) || hiddenCompanies.has(m.listing.company.toLowerCase())) return false;
      if (source !== "all" && m.listing.source !== source) return false;
      if (filter === "fit80") return m.fitScore > 80;
      if (filter === "remote") return m.listing.remoteType === "remote" || isRemote(m.listing.location);
      if (filter === "saved") return m.saved;
      return true;
    });
  }, [matches, filter, source, dismissedIds, hiddenCompanies]);

  async function dismiss(match: MatchCardData) {
    setDismissedIds((prev) => new Set(prev).add(match.id));
    await fetch(`/api/v1/matches/${match.id}/dismiss`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissed: true }),
    });
    setUndo({
      label: `Hidden “${match.listing.title}”.`,
      revert: async () => {
        await fetch(`/api/v1/matches/${match.id}/dismiss`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dismissed: false }),
        });
        setDismissedIds((prev) => {
          const next = new Set(prev);
          next.delete(match.id);
          return next;
        });
      },
    });
  }

  async function hideCompany(match: MatchCardData) {
    const company = match.listing.company.toLowerCase();
    setHiddenCompanies((prev) => new Set(prev).add(company));
    await fetch(`/api/v1/matches/${match.id}/hide-company`, { method: "POST", credentials: "include" });
    setUndo({
      label: `Hidden all jobs from ${match.listing.company}.`,
      revert: async () => {
        await fetch(`/api/v1/me/hidden-companies/${encodeURIComponent(company)}`, { method: "DELETE", credentials: "include" });
        setHiddenCompanies((prev) => {
          const next = new Set(prev);
          next.delete(company);
          return next;
        });
      },
    });
  }

  // Start from the first page whenever the filters change
  useEffect(() => setShown(PAGE_SIZE), [filter, source]);

  // Reveal the next page when the end of the list scrolls into view
  const hasMore = shown < visible.length;
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShown((n) => n + PAGE_SIZE);
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, shown]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold ${
              filter === f.key
                ? "border-accent bg-accent-soft text-accent-soft-ink"
                : "border-border bg-surface text-ink-muted"
            }`}
          >
            {f.label}
          </button>
        ))}

        {sourceOptions.length > 1 && (
          <label className="ml-auto flex items-center gap-2 text-[12.5px] font-semibold text-ink-muted">
            <span className="sr-only sm:not-sr-only">Source</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-ink focus:border-accent focus:outline-none"
            >
              <option value="all">All sources ({matches.length})</option>
              {sourceOptions.map(([id, count]) => (
                <option key={id} value={id}>
                  {sourceLabel(id, labels)} ({count})
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {undo && (
        <div role="status" className="mb-3 flex items-center justify-between gap-3 rounded-[10px] border border-border bg-surface-2 px-4 py-2.5 text-[12.5px]">
          <span>{undo.label}</span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={async () => {
                const action = undo;
                setUndo(null);
                await action.revert();
              }}
              className="font-bold text-accent hover:underline"
            >
              Undo
            </button>
            <button type="button" onClick={() => setUndo(null)} aria-label="Dismiss message" className="text-ink-muted hover:text-ink">
              ×
            </button>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-card border border-dashed border-border p-8 text-center text-ink-muted">
          No matches for this filter yet — check back after the next scan.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {visible.slice(0, shown).map((m) => (
            <MatchCard key={m.id} match={m} labels={labels} onDismiss={dismiss} onHideCompany={hideCompany} />
          ))}
          {hasMore && (
            <div ref={sentinelRef} className="py-3 text-center text-[12px] text-ink-muted">
              Showing {shown} of {visible.length}…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
