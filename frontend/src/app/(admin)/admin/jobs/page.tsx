"use client";

import { useState } from "react";
import { adminFetch, formatDateTime, toQuery, useAdminData, useDebounced, type AdminJobRow, type Paged } from "@/lib/admin";
import { Card, ConfirmAction, EmptyState, ErrorState, PageHeader, PaginationBar, RowsSkeleton, StatusBadge, inputCls } from "@/components/admin/AdminUI";

interface JobDetail {
  id: string;
  title: string;
  company: string;
  location: string;
  source: string;
  externalId: string;
  status: "open" | "closed" | "hidden";
  description: string;
  salaryText: string | null;
  remoteType: string;
  employmentType: string | null;
  url: string;
  applyUrl: string | null;
  postedAt: string | null;
  foundAt: string | null;
  lastSeenAt: string | null;
  moderation: { reason: string; by: string | null; at: string } | null;
  matches: number;
}

export default function AdminJobsPage() {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const q = useDebounced(search);
  const src = useDebounced(source);

  const list = useAdminData<Paged<AdminJobRow>>(`/api/v1/admin/jobs${toQuery({ page, limit: 20, search: q, source: src, status })}`);

  return (
    <div>
      <PageHeader title="Jobs" description="Search all stored listings. Hiding a job removes it from every feed (it stays hidden even if its source still lists it)." />

      <div className="mb-4 flex flex-wrap gap-2">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search title, company or location" aria-label="Search jobs" className={`${inputCls} min-w-[220px] flex-1`} />
        <input value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} placeholder="Source id" aria-label="Source" className={`${inputCls} w-[140px]`} />
        <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={inputCls}>
          <option value="">Any status</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="hidden">Hidden by admin</option>
        </select>
      </div>

      {list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <RowsSkeleton />
      ) : list.data.items.length === 0 ? (
        <EmptyState>No jobs match these filters.</EmptyState>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[12.5px]">
              <thead className="text-[11px] uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="py-2 pr-3">Job</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Found</th>
                  <th className="py-2 pr-3">Last seen</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.data.items.map((j) => (
                  <tr key={j.id} className={list.loading ? "opacity-60" : ""}>
                    <td className="py-2 pr-3">
                      <div className="font-semibold">{j.title}</div>
                      <div className="text-ink-muted">{j.company} · {j.location}</div>
                    </td>
                    <td className="py-2 pr-3 text-ink-muted">{j.source}</td>
                    <td className="py-2 pr-3"><StatusBadge status={j.status} /></td>
                    <td className="py-2 pr-3 text-ink-muted">{formatDateTime(j.foundAt)}</td>
                    <td className="py-2 pr-3 text-ink-muted">{formatDateTime(j.lastSeenAt)}</td>
                    <td className="py-2 text-right">
                      <button type="button" onClick={() => setSelected(selected === j.id ? null : j.id)} className="font-semibold text-accent hover:underline">
                        {selected === j.id ? "Close" : "Details"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar info={list.data.pagination} onPage={setPage} />
        </Card>
      )}

      {selected && <JobPanel id={selected} onChanged={list.reload} onClose={() => setSelected(null)} />}
    </div>
  );
}

function JobPanel({ id, onChanged, onClose }: { id: string; onChanged: () => void; onClose: () => void }) {
  const { data, error, reload } = useAdminData<{ job: JobDetail }>(`/api/v1/admin/jobs/${id}`);
  const setStatus = async (status: "hidden" | "visible", reason: string) => {
    await adminFetch(`/api/v1/admin/jobs/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, reason }) });
    await reload();
    onChanged();
  };

  return (
    <Card className="mt-4">
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <RowsSkeleton rows={3} />
      ) : (
        <div className="space-y-3 text-[12.5px]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold">{data.job.title}</h2>
              <div className="text-ink-muted">{data.job.company} · {data.job.location} · {data.job.remoteType}{data.job.salaryText ? ` · ${data.job.salaryText}` : ""}</div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={data.job.status} />
              <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink">Close</button>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-ink-muted sm:grid-cols-2">
            <div>Source: <span className="text-ink">{data.job.source}</span> (id {data.job.externalId})</div>
            <div>Matches: <span className="text-ink">{data.job.matches}</span></div>
            <div>Posted: <span className="text-ink">{formatDateTime(data.job.postedAt)}</span></div>
            <div>First seen: <span className="text-ink">{formatDateTime(data.job.foundAt)}</span></div>
            <div>Last fetched: <span className="text-ink">{formatDateTime(data.job.lastSeenAt)}</span></div>
            {data.job.employmentType && <div>Type: <span className="text-ink">{data.job.employmentType}</span></div>}
          </dl>
          <div className="flex flex-wrap gap-3">
            <a href={data.job.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">Original listing ↗</a>
            {data.job.applyUrl && <a href={data.job.applyUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">Apply URL ↗</a>}
          </div>
          {/* Descriptions are stored as plain text and rendered as text (never as HTML) */}
          <p className="max-h-48 overflow-y-auto whitespace-pre-line rounded-[8px] bg-surface-2 p-3 text-ink-muted">{data.job.description}</p>

          {data.job.moderation && (
            <div className="text-ink-muted">
              Last moderated {formatDateTime(data.job.moderation.at)} by {data.job.moderation.by ?? "unknown"}: “{data.job.moderation.reason}”
            </div>
          )}

          <div className="border-t border-border pt-3">
            {data.job.status === "hidden" ? (
              <ConfirmAction label="Restore" tone="default" description="The job returns to users' feeds." onConfirm={(reason) => setStatus("visible", reason)} />
            ) : (
              <ConfirmAction label="Hide job" description="Removes this job from every user's feed (for spam, scams or invalid listings)." onConfirm={(reason) => setStatus("hidden", reason)} />
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
