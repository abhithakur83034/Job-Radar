import Link from "next/link";
import { FitBadge } from "./FitBadge";
import { relativeTime } from "@/lib/format";
import { sourceLabel } from "@/lib/sources";

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
    url?: string;
    remoteType?: string;
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
          <span>{sourceLabel(listing.source)}</span>
          <span className="mx-1.5 opacity-60">•</span>
          Found {relativeTime(listing.foundAt)}
        </div>
        <div className="mt-1.5 text-[12.5px] italic text-ink-muted">&ldquo;{match.fitReason}&rdquo;</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {match.saved && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-accent-soft-ink">
              Saved
            </span>
          )}
          {listing.url && listing.url !== "#" && (
            // Source credit + link back to the original posting (required by the sources' terms;
            // a normal followed link, no nofollow)
            <a
              href={listing.url}
              target="_blank"
              rel="noopener"
              className="text-[12px] font-semibold text-accent hover:underline"
            >
              View on {sourceLabel(listing.source)} ↗
            </a>
          )}
        </div>
      </div>
      {/* No prefetch: one per card would trigger a hidden server render for every visible match */}
      <Link href={`/drafts?match=${match.id}`} prefetch={false} className="flex-none">
        <FitBadge score={match.fitScore} />
      </Link>
    </div>
  );
}
