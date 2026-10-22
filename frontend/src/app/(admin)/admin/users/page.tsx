"use client";

import { useState } from "react";
import { adminFetch, formatDateTime, toQuery, useAdminData, useDebounced, type AdminUserRow, type Paged } from "@/lib/admin";
import { Card, ConfirmAction, EmptyState, ErrorState, PageHeader, PaginationBar, RowsSkeleton, StatusBadge, inputCls } from "@/components/admin/AdminUI";

interface UserDetail extends AdminUserRow {
  companiesFollowed: number;
  hiddenCompanies: number;
  profiles: { name: string; titles: string[]; locations: string[]; seniority: string; fitThreshold: number }[];
  counts: { matches: number; saved: number; applications: number };
  hasResume: boolean;
  gmailConnected: boolean;
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const q = useDebounced(search);

  const list = useAdminData<Paged<AdminUserRow>>(`/api/v1/admin/users${toQuery({ page, limit: 20, search: q, role, status })}`);

  return (
    <div>
      <PageHeader title="Users" description="Search accounts, review activity, and change status or role. Passwords and résumé files are never shown." />

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search name, email or username"
          aria-label="Search users"
          className={`${inputCls} min-w-[220px] flex-1`}
        />
        <select aria-label="Role" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className={inputCls}>
          <option value="">All roles</option>
          <option value="user">Users</option>
          <option value="admin">Admins</option>
        </select>
        <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={inputCls}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <RowsSkeleton />
      ) : list.data.items.length === 0 ? (
        <EmptyState>No users match these filters.</EmptyState>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[12.5px]">
              <thead className="text-[11px] uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Registered</th>
                  <th className="py-2 pr-3">Last active</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.data.items.map((u) => (
                  <tr key={u.id} className={list.loading ? "opacity-60" : ""}>
                    <td className="py-2 pr-3">
                      <div className="font-semibold">{u.name}</div>
                      <div className="text-ink-muted">{u.username ? `@${u.username} · ` : ""}{u.email}</div>
                    </td>
                    <td className="py-2 pr-3"><StatusBadge status={u.role} /></td>
                    <td className="py-2 pr-3"><StatusBadge status={u.status} /></td>
                    <td className="py-2 pr-3 text-ink-muted">{formatDateTime(u.createdAt)}</td>
                    <td className="py-2 pr-3 text-ink-muted">{formatDateTime(u.lastActiveAt)}</td>
                    <td className="py-2 text-right">
                      <button type="button" onClick={() => setSelected(selected === u.id ? null : u.id)} className="font-semibold text-accent hover:underline">
                        {selected === u.id ? "Close" : "Manage"}
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

      {selected && <UserPanel id={selected} onChanged={list.reload} onClose={() => setSelected(null)} />}
    </div>
  );
}

function UserPanel({ id, onChanged, onClose }: { id: string; onChanged: () => void; onClose: () => void }) {
  const { data, error, reload } = useAdminData<{ user: UserDetail }>(`/api/v1/admin/users/${id}`);
  const [resetLink, setResetLink] = useState<{ url: string; expiresInMinutes: number } | null>(null);
  const after = async () => { await reload(); onChanged(); };

  return (
    <Card className="mt-4">
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <RowsSkeleton rows={3} />
      ) : (
        <div className="space-y-4 text-[12.5px]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold">{data.user.name}</h2>
              <div className="text-ink-muted">
                {data.user.username ? `@${data.user.username} · ` : ""}{data.user.email}{data.user.mobile ? ` · ${data.user.mobile}` : ""}
              </div>
            </div>
            <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink">Close</button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Fact label="Matches" value={data.user.counts.matches} />
            <Fact label="Saved" value={data.user.counts.saved} />
            <Fact label="Applications" value={data.user.counts.applications} />
            <Fact label="Companies followed" value={data.user.companiesFollowed} />
          </div>
          <div className="text-ink-muted">
            Résumé on file: {data.user.hasResume ? "yes" : "no"} · Gmail import: {data.user.gmailConnected ? "connected" : "not connected"}
          </div>
          {data.user.profiles.length > 0 && (
            <ul className="space-y-1">
              {data.user.profiles.map((p, i) => (
                <li key={i} className="rounded-[8px] bg-surface-2 px-3 py-2">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-ink-muted"> — {p.titles.join(", ") || "no titles"} · {p.locations.join(", ") || "any location"} · {p.seniority} · threshold {p.fitThreshold}%</span>
                </li>
              ))}
            </ul>
          )}

          {resetLink && (
            <div role="status" className="rounded-[8px] border border-accent/40 bg-accent/10 p-3">
              <div className="font-semibold">One-time reset link (expires in {resetLink.expiresInMinutes} minutes)</div>
              <p className="mt-1 text-ink-muted">Share it with the user privately. It isn&apos;t stored or shown again.</p>
              <div className="mt-2 flex gap-2">
                <input readOnly value={resetLink.url} aria-label="Reset link" onFocus={(e) => e.target.select()} className={`${inputCls} min-w-0 flex-1`} />
                <button type="button" onClick={() => navigator.clipboard.writeText(resetLink.url)} className="rounded-[8px] border border-border px-3 font-semibold">
                  Copy
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <ConfirmAction
              label="Create reset link"
              tone="default"
              description="Generates a one-time password reset link you can share with this user (for when email isn't available)."
              onConfirm={async (reason) => {
                setResetLink(await adminFetch(`/api/v1/admin/users/${id}/password-reset-link`, { method: "POST", body: JSON.stringify({ reason }) }));
              }}
            />
            {data.user.status === "suspended" ? (
              <ConfirmAction
                label="Reactivate"
                tone="default"
                description="The user will be able to sign in again."
                onConfirm={async (reason) => { await adminFetch(`/api/v1/admin/users/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "active", reason }) }); await after(); }}
              />
            ) : (
              <ConfirmAction
                label="Suspend"
                description="Signs the user out everywhere and blocks sign-in until reactivated. Their data is kept."
                onConfirm={async (reason) => { await adminFetch(`/api/v1/admin/users/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "suspended", reason }) }); await after(); }}
              />
            )}
            {data.user.role === "admin" ? (
              <ConfirmAction
                label="Remove admin"
                description="They will lose access to this admin portal."
                onConfirm={async (reason) => { await adminFetch(`/api/v1/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role: "user", reason }) }); await after(); }}
              />
            ) : (
              <ConfirmAction
                label="Make admin"
                tone="default"
                description="Admins can manage all users, jobs, sources and settings."
                onConfirm={async (reason) => { await adminFetch(`/api/v1/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role: "admin", reason }) }); await after(); }}
              />
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[8px] bg-surface-2 px-3 py-2">
      <div className="text-[11px] text-ink-muted">{label}</div>
      <div className="mono font-bold">{value.toLocaleString("en-IN")}</div>
    </div>
  );
}
