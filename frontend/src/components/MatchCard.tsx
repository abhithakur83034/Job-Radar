import Link from "next/link";
import { FitBadge } from "./FitBadge";
import { relativeTime } from "@/lib/format";

export interface MatchCardData {
  id: string;
  fitScore: number;
  fitReason: string;
  saved: boolean;
  listing: {
    title: string;
    company: string;
    location: string;
    salaryText: string | null;
    source: string;
    foundAt: string;
  };
}

export function MatchCard({ match }: { match: MatchCardData }) {
  const { listing } = match;
  return (
    <div className="flex items-start gap-3.5 rounded-card border border-border bg-surface p-4 shadow-sm">
      <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-surface-2 font-display text-[15px] font-bold">
        {listing.company[0]?.toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <span className="font-display text-[14.5px] font-bold">{listing.title}</span>{" "}
        <span className="text-ink-muted">· {listing.company}</span>
        <div className="mt-0.5 text-[12px] text-ink-muted">
          {listing.location}
          <span className="mx-1.5 opacity-60">•</span>
          {listing.salaryText ? (
            <span className="mono">{listing.salaryText}</span>
          ) : (
            <span>Salary not listed</span>
          )}
          <span className="mx-1.5 opacity-60">•</span>
          <span className="capitalize">{listing.source}</span>
          <span className="mx-1.5 opacity-60">•</span>
          Found {relativeTime(listing.foundAt)}
        </div>
        <div className="mt-1.5 text-[12.5px] italic text-ink-muted">&ldquo;{match.fitReason}&rdquo;</div>
        {match.saved && (
          <div className="mt-2">
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-accent-soft-ink">
              Saved
            </span>
          </div>
        )}
      </div>
      <Link href={`/drafts?match=${match.id}`} className="flex-none">
        <FitBadge score={match.fitScore} />
      </Link>
    </div>
  );
}
