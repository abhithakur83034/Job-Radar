"use client";

import { useMemo, useState } from "react";
import { MatchCard, type MatchCardData } from "./MatchCard";
import { isRemote } from "@/lib/format";

type Filter = "all" | "fit80" | "remote" | "saved";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All sources" },
  { key: "fit80", label: "Fit > 80%" },
  { key: "remote", label: "Remote" },
  { key: "saved", label: "Saved" },
];

export function MatchFeedClient({ matches }: { matches: MatchCardData[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    return matches.filter((m) => {
      if (filter === "fit80") return m.fitScore > 80;
      if (filter === "remote") return isRemote(m.listing.location);
      if (filter === "saved") return m.saved;
      return true;
    });
  }, [matches, filter]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold ${
              filter === f.key
                ? "border-accent bg-accent-soft text-accent-soft-ink"
                : "border-border bg-surface text-ink-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
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
