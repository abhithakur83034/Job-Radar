import { relativeTime } from "@/lib/format";
import type { JobSourceStatus } from "@/lib/sources";

/** One-line summary of background job sources: which are on, how fresh, and any failing. */
export function JobRefreshStatus({ sources }: { sources: JobSourceStatus[] }) {
  const active = sources.filter((s) => s.configured);
  if (active.length === 0) {
    return <span>Company job boards · scan them any time</span>;
  }

  const lastSuccess = active
    .map((s) => s.lastSuccessAt)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);
  const failing = active.filter((s) => s.lastStatus === "failed");

  return (
    <span>
      {active.map((s, i) => (
        <span key={s.id}>
          {i > 0 && " · "}
          {/* Source credit with link back, as the sources' terms require */}
          <a href={s.homepage} target="_blank" rel="noopener" className="hover:text-white hover:underline">
            {s.displayName}
          </a>
        </span>
      ))}
      {" + your company boards"}
      <span className="block sm:inline">
        <span className="hidden sm:inline"> — </span>
        {lastSuccess ? `updated ${relativeTime(lastSuccess)}` : "waiting for first refresh"}
        {failing.length > 0 && (
          <span className="text-danger">
            {" "}· {failing.map((s) => s.displayName).join(", ")} temporarily unavailable
          </span>
        )}
      </span>
    </span>
  );
}
