"use client";

import Link from "next/link";
import { useAdminData, formatDateTime, formatDuration, type RefreshRun } from "@/lib/admin";
import { Card, EmptyState, ErrorState, PageHeader, RowsSkeleton, StatCard, StatusBadge } from "@/components/admin/AdminUI";

interface Overview {
  users: { total: number; active7d: number; new7d: number; suspended: number; admins: number };
  jobs: { total: number; open: number; closed: number; hidden: number; new24h: number; openBySource: { source: string; count: number }[] };
  matches: { total: number; saved: number; new24h: number };
  applications: { total: number };
  notifications: { sent7d: number };
  sources: { id: string; displayName: string; configured: boolean; lastStatus: string | null; lastSuccessAt: string | null; lastFetched: number; lastError: string | null }[];
  lastRun: RefreshRun | null;
  recentProblems: RefreshRun[];
  features: { gmailImport: boolean; pushNotifications: boolean };
}

export default function AdminOverviewPage() {
  const { data, error, loading, reload } = useAdminData<Overview>("/api/v1/admin/overview");

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Live numbers from the database. Active user = signed in within 7 days; open job = not closed by its source and not hidden by an admin."
        action={
          <button type="button" onClick={reload} disabled={loading} className="rounded-[8px] border border-border px-3 py-1.5 text-[12px] font-semibold text-ink-muted hover:text-ink disabled:opacity-40">
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <RowsSkeleton rows={6} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Users" value={data.users.total} hint={`${data.users.new7d} new this week · ${data.users.admins} admin(s)`} />
            <StatCard label="Active users (7d)" value={data.users.active7d} hint={data.users.suspended ? `${data.users.suspended} suspended` : "None suspended"} />
            <StatCard label="Open jobs" value={data.jobs.open} hint={`${data.jobs.new24h} found in 24h · ${data.jobs.closed} closed · ${data.jobs.hidden} hidden`} />
            <StatCard label="Matches" value={data.matches.total} hint={`${data.matches.new24h} new in 24h · ${data.matches.saved} saved`} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Source health">
              {data.sources.length === 0 ? (
                <EmptyState>No sources registered.</EmptyState>
              ) : (
                <ul className="divide-y divide-border">
                  {data.sources.map((s) => (
                    <li key={s.id} className="flex items-start justify-between gap-3 py-2 text-[12.5px]">
                      <div className="min-w-0">
                        <div className="font-semibold">{s.displayName}</div>
                        <div className="text-ink-muted">
                          {s.configured ? (s.lastSuccessAt ? `Last success ${formatDateTime(s.lastSuccessAt)} · ${s.lastFetched} jobs` : "Not run yet") : "Needs credentials"}
                        </div>
                        {s.lastStatus === "failed" && s.lastError && <div className="mt-0.5 break-words text-danger">{s.lastError}</div>}
                      </div>
                      <StatusBadge status={s.configured ? s.lastStatus ?? "not_due" : "not_configured"} />
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/admin/sources" className="mt-3 inline-block text-[12px] font-semibold text-accent hover:underline">
                Sources & refresh history →
              </Link>
            </Card>

            <div className="space-y-5">
              <Card title="Last refresh">
                {data.lastRun ? (
                  <div className="text-[12.5px]">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={data.lastRun.status} />
                      <span className="text-ink-muted">{formatDateTime(data.lastRun.startedAt)} · {formatDuration(data.lastRun.durationMs)} · {data.lastRun.trigger}</span>
                    </div>
                    <div className="mt-2 text-ink-muted">
                      {data.lastRun.newListings} new jobs · {data.lastRun.newMatches} new matches · {data.lastRun.closedJobs} closed
                    </div>
                  </div>
                ) : (
                  <EmptyState>No refresh has run yet.</EmptyState>
                )}
              </Card>

              <Card title="Recent problems">
                {data.recentProblems.length === 0 ? (
                  <p className="text-[12.5px] text-ink-muted">No failed or partial runs recorded.</p>
                ) : (
                  <ul className="space-y-2 text-[12.5px]">
                    {data.recentProblems.map((r) => (
                      <li key={r.id}>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={r.status} />
                          <span className="text-ink-muted">{formatDateTime(r.startedAt)}</span>
                        </div>
                        <div className="mt-0.5 break-words text-ink-muted">
                          {r.error || r.providers.filter((p) => p.status === "failed").map((p) => `${p.id}: ${p.error ?? "failed"}`).join(" · ")}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="Activity & features">
                <ul className="space-y-1 text-[12.5px] text-ink-muted">
                  <li>{data.applications.total.toLocaleString("en-IN")} applications tracked</li>
                  <li>{data.notifications.sent7d.toLocaleString("en-IN")} notifications sent this week</li>
                  <li>Gmail job-alert import: {data.features.gmailImport ? "configured" : "not configured"}</li>
                  <li>Browser push notifications: {data.features.pushNotifications ? "configured" : "not configured"}</li>
                </ul>
              </Card>
            </div>
          </div>

          {data.jobs.openBySource.length > 0 && (
            <Card title="Open jobs by source">
              <ul className="grid grid-cols-2 gap-2 text-[12.5px] sm:grid-cols-4">
                {data.jobs.openBySource.map((s) => (
                  <li key={s.source} className="flex justify-between rounded-[8px] bg-surface-2 px-3 py-2">
                    <span>{s.source}</span>
                    <span className="mono font-semibold">{s.count.toLocaleString("en-IN")}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
