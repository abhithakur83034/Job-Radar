"use client";

import { useState } from "react";
import type { ApiError, Pagination as PaginationInfo } from "@/lib/admin";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-[20px] font-bold text-ink">{title}</h1>
        {description && <p className="mt-0.5 text-[12.5px] text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-card border border-border bg-surface p-5 ${className}`}>
      {title && <h2 className="mb-3 text-[13.5px] font-bold">{title}</h2>}
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="mono mt-1 text-[24px] font-bold text-ink">{typeof value === "number" ? value.toLocaleString("en-IN") : value}</div>
      {hint && <div className="mt-0.5 text-[11.5px] text-ink-muted">{hint}</div>}
    </div>
  );
}

const TONES: Record<string, string> = {
  good: "border-success bg-success-bg text-success",
  bad: "border-danger bg-danger-bg text-danger",
  warn: "border-accent bg-accent-soft text-accent-soft-ink",
  neutral: "border-border bg-surface-2 text-ink-muted",
};

const STATUS_TONE: Record<string, keyof typeof TONES> = {
  active: "good", open: "good", success: "good", completed: "good", admin: "warn",
  suspended: "bad", failed: "bad", hidden: "bad", failure: "bad",
  partial: "warn", running: "warn", closed: "neutral", not_due: "neutral", not_configured: "neutral", user: "neutral",
};

const STATUS_TEXT: Record<string, string> = { not_due: "Not due", not_configured: "Not configured" };

/** Status as text plus colour (never colour alone). */
export function StatusBadge({ status }: { status: string | null | undefined }) {
  const key = status ?? "unknown";
  const tone = TONES[STATUS_TONE[key] ?? "neutral"];
  const label = STATUS_TEXT[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{label}</span>;
}

export function ErrorState({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-card border border-danger bg-danger-bg p-4 text-[12.5px] text-danger">
      <div className="font-semibold">Couldn&apos;t load this section</div>
      <div className="mt-0.5">{error.message}</div>
      <button type="button" onClick={onRetry} className="mt-2 rounded-[8px] border border-danger px-3 py-1 font-semibold hover:bg-bg">
        Retry
      </button>
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-card border border-dashed border-border p-6 text-center text-[12.5px] text-ink-muted">{children}</div>;
}

export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-busy="true" className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-[8px] bg-surface-2" />
      ))}
    </div>
  );
}

export function PaginationBar({ info, onPage }: { info: PaginationInfo | undefined; onPage: (page: number) => void }) {
  if (!info || info.totalPages <= 1) {
    return info ? <div className="mt-3 text-[12px] text-ink-muted">{info.total.toLocaleString("en-IN")} total</div> : null;
  }
  return (
    <div className="mt-3 flex items-center justify-between gap-2 text-[12px] text-ink-muted">
      <span>
        Page {info.page} of {info.totalPages} · {info.total.toLocaleString("en-IN")} total
      </span>
      <div className="flex gap-2">
        <button type="button" disabled={info.page <= 1} onClick={() => onPage(info.page - 1)} className="rounded-[8px] border border-border px-3 py-1 font-semibold hover:text-ink disabled:opacity-40">
          Previous
        </button>
        <button type="button" disabled={info.page >= info.totalPages} onClick={() => onPage(info.page + 1)} className="rounded-[8px] border border-border px-3 py-1 font-semibold hover:text-ink disabled:opacity-40">
          Next
        </button>
      </div>
    </div>
  );
}

export const inputCls = "rounded-[8px] border border-border bg-bg px-3 py-1.5 text-[12.5px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none";

/**
 * In-context confirmation for sensitive actions: asks for a reason, then calls
 * onConfirm(reason). Shows the server's error inline; disables while working.
 */
export function ConfirmAction({
  label,
  confirmLabel,
  description,
  tone = "danger",
  onConfirm,
}: {
  label: string;
  confirmLabel?: string;
  description: string;
  tone?: "danger" | "default";
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buttonTone = tone === "danger" ? "border-danger text-danger hover:bg-danger-bg" : "border-border text-ink hover:text-ink";

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`rounded-[8px] border px-3 py-1.5 text-[12px] font-semibold ${buttonTone}`}>
        {label}
      </button>
    );
  }
  return (
    <div className="w-full rounded-[10px] border border-border bg-bg p-3">
      <p className="text-[12px] text-ink-muted">{description}</p>
      <label className="mt-2 block text-[11.5px] font-semibold text-ink-muted" htmlFor={`reason-${label}`}>
        Reason (required, saved in the audit log)
      </label>
      <input
        id={`reason-${label}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why are you doing this?"
        className={`${inputCls} mt-1 w-full`}
        maxLength={500}
        autoFocus
      />
      {error && <p role="alert" className="mt-1.5 text-[11.5px] text-danger">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={busy || reason.trim().length < 3}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onConfirm(reason.trim());
              setOpen(false);
              setReason("");
            } catch (err: any) {
              setError(err?.message || "Action failed");
            } finally {
              setBusy(false);
            }
          }}
          className={`rounded-[8px] border px-3 py-1.5 text-[12px] font-bold disabled:opacity-40 ${buttonTone}`}
        >
          {busy ? "Working…" : confirmLabel ?? `Confirm ${label.toLowerCase()}`}
        </button>
        <button type="button" disabled={busy} onClick={() => { setOpen(false); setError(null); }} className="rounded-[8px] px-3 py-1.5 text-[12px] font-semibold text-ink-muted hover:text-ink">
          Cancel
        </button>
      </div>
    </div>
  );
}
