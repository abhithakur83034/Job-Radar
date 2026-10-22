"use client";

import { useMemo, useState } from "react";
import { MatchCard, type MatchCardData } from "./MatchCard";
import { isRemote } from "@/lib/format";
import { sourceLabel } from "@/lib/sources";

type Filter = "all" | "fit80" | "remote" | "saved";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All matches" },
  { key: "fit80", label: "Fit > 80%" },
  { key: "remote", label: "Remote" },
  { key: "saved", label: "Saved" },
];

export function MatchFeedClient({ matches }: { matches: MatchCardData[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [source, setSource] = useState("all");

  // Only offer sources that actually have matches, with counts
  const sourceOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of matches) counts.set(m.listing.source, (counts.get(m.listing.source) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [matches]);

  const visible = useMemo(() => {
    return matches.filter((m) => {
      if (source !== "all" && m.listing.source !== source) return false;
      if (filter === "fit80") return m.fitScore > 80;
      if (filter === "remote") return m.listing.remoteType === "remote" || isRemote(m.listing.location);
      if (filter === "saved") return m.saved;
      return true;
    });
  }, [matches, filter, source]);

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
                  {sourceLabel(id)} ({count})
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-card border border-dashed border-border p-8 text-center text-ink-muted">
          No matches for this filter yet — check back after the next scan.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {visible.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </div>
  );
}
