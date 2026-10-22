"use client";

import { useState } from "react";
import { adminFetch, formatDateTime, formatDuration, toQuery, useAdminData, type Paged, type RefreshRun } from "@/lib/admin";
import { Card, EmptyState, ErrorState, PageHeader, PaginationBar, RowsSkeleton, StatusBadge, inputCls } from "@/components/admin/AdminUI";

interface SourceStatus {
  id: string;
  displayName: string;
  homepage: string;
  requiresKey: boolean;
  configured: boolean;
  refreshEveryMinutes: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastStatus: "success" | "failed" | null;
  lastFetched: number;
  lastError: string | null;
  setup: string | null;
}

interface RefreshResult {
  run: { id: string; outcome: string; durationMs: number; newListings: number; newMatches: number };
  providers: { id: string; status: string; fetched?: number; error?: string }[];
}

export default function AdminSourcesPage() {
  const [page, setPage] = useState(1);
  const sources = useAdminData<{ sources: SourceStatus[] }>("/api/v1/admin/job-sources");
  const runs = useAdminData<Paged<RefreshRun>>(`/api/v1/admin/job-sources/runs${toQuery({ page, limit: 10 })}`);

  const [refreshState, setRefreshState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function triggerRefresh() {
    setRefreshState("running");
    setRefreshMessage(null);
    try {
      const result = await adminFetch<RefreshResult>("/api/v1/admin/job-sources/refresh", {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      const notDue = result.providers.filter((p) => p.status === "not_due").length;
      setRefreshState("done");
      setRefreshMessage(
        `Run ${result.run.outcome} in ${formatDuration(result.run.durationMs)}: ${result.run.newListings} new jobs, ${result.run.newMatches} new matches.` +
          (notDue ? ` ${notDue} source(s) skipped because their rate limit hasn't elapsed.` : "")
      );
      setReason("");
    } catch (err: any) {
      setRefreshState("error");
      setRefreshMessage(err?.message || "Refresh failed");
    } finally {
      sources.reload();
      runs.reload();
    }
  }

  return (
    <div>
      <PageHeader title="Job sources" description="Status of every source, refresh history, and a manual refresh. Each source's rate limit still applies to manual runs." />

      <Card title="Run a refresh now" className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional, saved in the audit log)" aria-label="Reason" maxLength={500} className={`${inputCls} min-w-[240px] flex-1`} disabled={refreshState === "running"} />
          <button
            type="button"
            onClick={triggerRefresh}
            disabled={refreshState === "running"}
            className="rounded-[8px] bg-accent px-4 py-1.5 text-[12.5px] font-bold text-accent-ink disabled:opacity-50"
          >
            {refreshState === "running" ? "Running… (can take a minute)" : "Refresh due sources"}
          </button>
        </div>
        {refreshMessage && (
          <p role="status" className={`mt-2 text-[12.5px] ${refreshState === "error" ? "text-danger" : "text-success"}`}>
            {refreshState === "error" ? "Failed: " : "Done: "}
            {refreshMessage}
          </p>
        )}
      </Card>

      <Card title="Sources" className="mb-5">
        {sources.error ? (
          <ErrorState error={sources.error} onRetry={sources.reload} />
        ) : !sources.data ? (
          <RowsSkeleton rows={4} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[12.5px]">
              <thead className="text-[11px] uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Last success</th>
                  <th className="py-2 pr-3">Last attempt</th>
                  <th className="py-2 pr-3">Jobs</th>
                  <th className="py-2">Every</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sources.data.sources.map((s) => (
                  <tr key={s.id} className="align-top">
                    <td className="py-2 pr-3">
                      <div className="font-semibold">{s.displayName}</div>
                      {s.setup && <div className="mt-0.5 max-w-[320px] text-[11.5px] text-ink-muted">{s.setup}</div>}
                      {s.lastStatus === "failed" && s.lastError && <div className="mt-0.5 max-w-[320px] break-words text-[11.5px] text-danger">{s.lastError}</div>}
                    </td>
                    <td className="py-2 pr-3"><StatusBadge status={s.configured ? s.lastStatus ?? "not_due" : "not_configured"} /></td>
                    <td className="py-2 pr-3 text-ink-muted">{formatDateTime(s.lastSuccessAt)}</td>
                    <td className="py-2 pr-3 text-ink-muted">{formatDateTime(s.lastAttemptAt)}</td>
                    <td className="mono py-2 pr-3">{s.lastFetched}</td>
                    <td className="py-2 text-ink-muted">{s.refreshEveryMinutes >= 60 ? `${s.refreshEveryMinutes / 60} h` : `${s.refreshEveryMinutes} min`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Refresh history">
        {runs.error ? (
          <ErrorState error={runs.error} onRetry={runs.reload} />
        ) : !runs.data ? (
          <RowsSkeleton rows={4} />
        ) : runs.data.items.length === 0 ? (
          <EmptyState>No refresh runs recorded yet.</EmptyState>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {runs.data.items.map((r) => (
                <li key={r.id} className="py-2.5 text-[12.5px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={r.status} />
                    <span className="font-semibold">{formatDateTime(r.startedAt)}</span>
                    <span className="text-ink-muted">· {r.trigger} · {formatDuration(r.durationMs)}</span>
                  </div>
                  <div className="mt-1 text-ink-muted">
                    {r.newListings} new jobs · {r.newMatches} new matches · {r.closedJobs} closed
                  </div>
                  {r.providers.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {r.providers.map((p) => (
                        <span key={p.id} title={p.error ?? undefined} className="rounded-[6px] bg-surface-2 px-2 py-0.5 text-[11px]">
                          {p.id}: {p.status.replace("_", " ")}{p.fetched !== undefined ? ` (${p.fetched})` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                  {r.error && <div className="mt-1 text-danger">{r.error}</div>}
                </li>
              ))}
            </ul>
            <PaginationBar info={runs.data.pagination} onPage={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
