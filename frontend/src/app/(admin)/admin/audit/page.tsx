"use client";

import { useState } from "react";
import { formatDateTime, toQuery, useAdminData, type Paged } from "@/lib/admin";
import { Card, EmptyState, ErrorState, PageHeader, PaginationBar, RowsSkeleton, StatusBadge, inputCls } from "@/components/admin/AdminUI";

interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  reason: string | null;
  outcome: "success" | "failure";
  changes: Record<string, unknown> | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  "user.status.update": "Changed account status",
  "user.role.update": "Changed role",
  "job.hide": "Hid job",
  "job.restore": "Restored job",
  "job-refresh.trigger": "Triggered refresh",
  "settings.update": "Updated settings",
  "settings.reset": "Reset settings",
};

function describeChanges(changes: Record<string, unknown> | null) {
  if (!changes) return null;
  if ("from" in changes && "to" in changes && typeof changes.from !== "object") return `${changes.from} → ${changes.to}`;
  return Object.entries(changes)
    .map(([k, v]) => (v && typeof v === "object" && "to" in (v as any) ? `${k}: ${(v as any).from} → ${(v as any).to}` : `${k}: ${String(v)}`))
    .join(" · ");
}

export default function AdminAuditPage() {
  const [targetType, setTargetType] = useState("");
  const [page, setPage] = useState(1);
  const logs = useAdminData<Paged<AuditEntry>>(`/api/v1/admin/audit-logs${toQuery({ page, limit: 25, targetType })}`);

  return (
    <div>
      <PageHeader title="Audit log" description="Every sensitive admin action: who did it, to what, when, why, and the outcome." />
      <div className="mb-4">
        <select aria-label="Filter by target" value={targetType} onChange={(e) => { setTargetType(e.target.value); setPage(1); }} className={inputCls}>
          <option value="">All actions</option>
          <option value="user">Users</option>
          <option value="job">Jobs</option>
          <option value="job-refresh">Refreshes</option>
          <option value="settings">Settings</option>
        </select>
      </div>

      {logs.error ? (
        <ErrorState error={logs.error} onRetry={logs.reload} />
      ) : !logs.data ? (
        <RowsSkeleton />
      ) : logs.data.items.length === 0 ? (
        <EmptyState>No audit entries yet.</EmptyState>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {logs.data.items.map((a) => (
              <li key={a.id} className="py-2.5 text-[12.5px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{ACTION_LABELS[a.action] ?? a.action}</span>
                  {a.outcome === "failure" && <StatusBadge status="failure" />}
                  <span className="text-ink-muted">by {a.actor} · {formatDateTime(a.createdAt)}</span>
                </div>
                {(a.targetLabel || a.targetId) && <div className="mt-0.5 text-ink-muted">Target: {a.targetLabel ?? a.targetId}</div>}
                {describeChanges(a.changes) && <div className="mt-0.5 text-ink-muted">{describeChanges(a.changes)}</div>}
                {a.reason && <div className="mt-0.5 italic text-ink-muted">“{a.reason}”</div>}
              </li>
            ))}
          </ul>
          <PaginationBar info={logs.data.pagination} onPage={setPage} />
        </Card>
      )}
    </div>
  );
}
