"use client";

import { useState, useTransition } from "react";
import { markFollowUpSent } from "./actions";

export function ApplicationRowActions({
  applicationId,
  isDue,
  appliedAt,
  lastUpdateAt,
  status,
}: {
  applicationId: string;
  isDue: boolean;
  appliedAt: string;
  lastUpdateAt: string;
  status: string;
}) {
  const [open, setOpen] = useState<"followup" | "timeline" | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function openFollowup() {
    setOpen("followup");
    setLoading(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "email" }),
      });
      const data = await res.json();
      setMessage(data.message ?? "");
    } finally {
      setLoading(false);
    }
  }

  function markSent() {
    startTransition(async () => {
      await markFollowUpSent(applicationId);
      setOpen(null);
    });
  }

  return (
    <div className="relative">
      {isDue ? (
        <button
          onClick={openFollowup}
          className="rounded-[8px] bg-accent px-3 py-1.5 text-[12px] font-semibold text-accent-ink"
        >
          Draft follow-up
        </button>
      ) : (
        <button
          onClick={() => setOpen("timeline")}
          className="rounded-[8px] border border-border px-3 py-1.5 text-[12px] font-semibold"
        >
          View timeline
        </button>
      )}

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-[320px] rounded-card border border-border bg-surface p-4 text-left shadow-lg">
          {open === "followup" ? (
            <>
              <div className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-ink-muted">
                Drafted follow-up
              </div>
              {loading ? (
                <div className="text-[12.5px] text-ink-muted">Drafting…</div>
              ) : (
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  className="mono w-full resize-y rounded-[9px] border border-border bg-bg p-2.5 text-[12px]"
                />
              )}
              <div className="mt-3 flex justify-between gap-2">
                <button
                  onClick={() => setOpen(null)}
                  className="rounded-[8px] border border-border px-3 py-1.5 text-[12px] font-semibold"
                >
                  Dismiss
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(message);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    className="rounded-[8px] border border-border px-3 py-1.5 text-[12px] font-semibold"
                  >
                    {copied ? "Copied ✓" : "Copy"}
                  </button>
                  <button
                    onClick={markSent}
                    disabled={isPending}
                    className="rounded-[8px] bg-sidebar px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
                  >
                    Mark as sent
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-ink-muted">Timeline</div>
              <ul className="space-y-1.5 text-[12.5px]">
                <li>
                  <span className="mono text-ink-muted">{appliedAt}</span> — Applied
                </li>
                <li>
                  <span className="mono text-ink-muted">{lastUpdateAt}</span> — Last update ({status})
                </li>
              </ul>
              <button
                onClick={() => setOpen(null)}
                className="mt-3 rounded-[8px] border border-border px-3 py-1.5 text-[12px] font-semibold"
              >
                Close
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
