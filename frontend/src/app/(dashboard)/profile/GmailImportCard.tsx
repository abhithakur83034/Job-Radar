"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface GmailStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  lastSyncAt: string | null;
}

const CALLBACK_MESSAGES: Record<string, { tone: "success" | "danger"; text: string }> = {
  connected: { tone: "success", text: "Gmail connected. Import your job alerts below." },
  denied: { tone: "danger", text: "Gmail access was not granted." },
  missing_scope: {
    tone: "danger",
    text: "JobRadar needs the “Read your email” permission to import job alerts. Please connect again and keep it ticked.",
  },
  invalid_state: { tone: "danger", text: "That sign-in link expired or was not started here. Please try again." },
  error: { tone: "danger", text: "Google sign-in failed. Please try again." },
};

const PORTAL_ALERT_LINKS = [
  { name: "LinkedIn", href: "https://www.linkedin.com/jobs/" },
  { name: "Naukri", href: "https://www.naukri.com/" },
  { name: "Indeed", href: "https://in.indeed.com/" },
];

export function GmailImportCard() {
  const router = useRouter();
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [isWorking, startWork] = useTransition();

  async function loadStatus() {
    const res = await fetch("/api/v1/gmail/status", { credentials: "include" });
    if (res.ok) setStatus(await res.json());
  }

  useEffect(() => {
    loadStatus();
    // Show the result of the Google redirect once, then clean the URL
    const params = new URLSearchParams(window.location.search);
    const result = params.get("gmail");
    if (result && CALLBACK_MESSAGES[result]) {
      setNotice(CALLBACK_MESSAGES[result]);
      params.delete("gmail");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    }
  }, []);

  function importNow() {
    setNotice(null);
    startWork(async () => {
      const res = await fetch("/api/v1/gmail/sync", { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ tone: "danger", text: data.error || "Import failed. Please try again." });
        if (data.reconnect) await loadStatus();
        return;
      }
      const sources = Object.entries(data.bySource ?? {})
        .map(([source, count]) => `${count} ${source}`)
        .join(", ");
      setNotice({
        tone: "success",
        text:
          data.emailsScanned === 0
            ? "No new job-alert emails found yet. Alerts usually arrive daily once set up."
            : `Read ${data.emailsScanned} alert emails: ${data.listingsFound} jobs${sources ? ` (${sources})` : ""}, ${data.newMatches} new matches.`,
      });
      await loadStatus();
      router.refresh();
    });
  }

  function disconnect() {
    if (!window.confirm("Disconnect Gmail? JobRadar will revoke its access at Google.")) return;
    startWork(async () => {
      await fetch("/api/v1/gmail", { method: "DELETE", credentials: "include" });
      setNotice({ tone: "success", text: "Gmail disconnected and access revoked." });
      await loadStatus();
    });
  }

  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13.5px] font-bold">Job alert emails</h3>
        {status?.connected && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] font-semibold text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Connected
          </span>
        )}
      </div>
      <p className="mt-1 text-[12px] text-ink-muted">
        Import jobs from your LinkedIn, Naukri and Indeed alert emails. JobRadar never sees your
        passwords and only reads emails from those job-alert senders.
      </p>

      {notice && (
        <div
          className={`mt-3 rounded-[8px] border p-2.5 text-[12px] font-medium ${
            notice.tone === "success"
              ? "border-success/30 bg-success/10 text-success"
              : "border-danger/30 bg-danger/10 text-danger"
          }`}
        >
          {notice.text}
        </div>
      )}

      {!status ? (
        <div className="mt-3 h-9 animate-pulse rounded-[8px] bg-surface-2" />
      ) : !status.configured ? (
        <div className="mt-3 rounded-[8px] border border-dashed border-border p-3 text-[12px] text-ink-muted">
          Gmail import isn&apos;t set up on this server yet.
        </div>
      ) : status.connected ? (
        <div className="mt-3 space-y-3">
          <div className="text-[12px] text-ink-muted">
            <span className="font-semibold text-ink">{status.email}</span>
            {" · "}
            {status.lastSyncAt
              ? `last imported ${new Date(status.lastSyncAt).toLocaleString()}`
              : "not imported yet"}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={importNow}
              disabled={isWorking}
              className="rounded-[8px] bg-accent px-3.5 py-1.5 text-[12.5px] font-bold text-accent-ink hover:brightness-105 disabled:opacity-50"
            >
              {isWorking ? "Importing…" : "Import job alerts now"}
            </button>
            <button
              type="button"
              onClick={disconnect}
              disabled={isWorking}
              className="rounded-[8px] border border-border px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted hover:text-white disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        // Full-page navigation: the backend redirects to Google's consent screen
        <a
          href="/api/v1/gmail/connect"
          className="mt-3 inline-flex items-center gap-2 rounded-[8px] border border-border bg-surface-2 px-3.5 py-2 text-[12.5px] font-semibold text-ink hover:border-accent hover:text-accent"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path fill="#EA4335" d="M5 6.5 12 11.5l7-5V18a1 1 0 0 1-1 1h-2v-7.2L12 14.7 8 11.8V19H6a1 1 0 0 1-1-1z" />
            <path fill="#FBBC04" d="M19 6.5 12 11.5 5 6.5V6a1 1 0 0 1 1.6-.8L12 9l5.4-3.8A1 1 0 0 1 19 6z" />
          </svg>
          Connect Gmail
        </a>
      )}

      <div className="mt-4 border-t border-border pt-3 text-[11.5px] text-ink-muted">
        <div className="font-semibold text-ink">First, turn on job alerts:</div>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {PORTAL_ALERT_LINKS.map((p) => (
            <li key={p.name}>
              <a href={p.href} target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">
                {p.name}
              </a>{" "}
              — search for your role, then enable “Job alert” / “Create alert”
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
