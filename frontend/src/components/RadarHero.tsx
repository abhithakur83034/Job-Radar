import { ScanPortalsButton } from "./ScanPortalsButton";
import { JobRefreshStatus } from "./JobRefreshStatus";
import type { JobSourceStatus } from "@/lib/sources";

export function RadarHero({
  newMatchCount,
  sourceCount,
  sources,
}: {
  newMatchCount: number;
  sourceCount: number;
  sources: JobSourceStatus[];
}) {
  return (
    <div className="relative mb-5 flex items-center justify-between gap-6 overflow-hidden rounded-card bg-gradient-to-br from-sidebar to-sidebar-top p-5 text-white sm:p-7">
      <div>
        <div className="text-[11.5px] font-semibold uppercase tracking-wide text-sidebar-ink">
          Scanning {sourceCount} sources
        </div>
        <h2 className="mt-2 max-w-[360px] text-balance font-display text-[23px] font-bold leading-tight sm:text-[27px]">
          <b className="text-accent">{newMatchCount} new</b> strong matches found today
        </h2>
        <div className="mt-3.5 flex flex-wrap items-center gap-3 text-[12.5px] text-sidebar-ink">
          <JobRefreshStatus sources={sources} />
          <ScanPortalsButton />
        </div>
      </div>
      <div className="relative hidden h-[150px] w-[150px] flex-none sm:block" aria-hidden="true">
        <div className="radar-ring inset-0" />
        <div className="radar-ring inset-[22px]" />
        <div className="radar-ring inset-[44px]" />
        <div className="radar-ring inset-[66px]" />
        <div className="radar-sweep" />
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
        <div className="radar-ping" style={{ left: 112, top: 38, animationDelay: "0s" }} />
        <div className="radar-ping" style={{ left: 40, top: 100, animationDelay: "0.7s" }} />
        <div className="radar-ping" style={{ left: 80, top: 120, animationDelay: "1.4s" }} />
      </div>
    </div>
  );
}
