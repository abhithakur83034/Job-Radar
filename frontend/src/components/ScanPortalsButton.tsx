"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
function SearchIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function RefreshIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function CheckIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function PlusIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function CloseIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

const DEFAULT_POPULAR_COMPANIES = [
  { slug: "gitlab", name: "GitLab" },
  { slug: "reddit", name: "Reddit" },
  { slug: "affirm", name: "Affirm" },
  { slug: "brex", name: "Brex" },
  { slug: "canonical", name: "Canonical" },
  { slug: "datadog", name: "Datadog" },
  { slug: "stripe", name: "Stripe" },
  { slug: "automattic", name: "Automattic" },
  { slug: "cloudflare", name: "Cloudflare" },
  { slug: "figma", name: "Figma" },
];

export function ScanPortalsButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([
    "gitlab",
    "reddit",
    "affirm",
    "brex",
    "canonical",
    "datadog",
  ]);
  const [customSlug, setCustomSlug] = useState("");
  const [isScanning, startScan] = useTransition();
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function toggleSlug(slug: string) {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  function addCustomSlug() {
    const clean = customSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!clean) return;
    if (!selectedSlugs.includes(clean)) {
      setSelectedSlugs((prev) => [...prev, clean]);
    }
    setCustomSlug("");
  }

  function handleScan() {
    if (selectedSlugs.length === 0) {
      setErrorMsg("Please select at least one company portal to scan.");
      return;
    }

    setErrorMsg(null);
    setResultMsg(null);

    startScan(async () => {
      try {
        const res = await fetch("/api/listings/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boardTokens: selectedSlugs }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Scan failed with status ${res.status}`);
        }

        const data = await res.json();
        setResultMsg(
          `✓ Scan complete: Analyzed ${data.listingsSeen} listings across ${selectedSlugs.length} portals. Found ${data.newMatches} new matches scored against your profile!`
        );

        router.refresh();
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to scan portals. Please try again.");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-[9px] border border-accent bg-accent/20 px-3.5 py-2 text-[12.5px] font-bold text-accent transition hover:bg-accent hover:text-accent-ink"
      >
        <SearchIcon className="h-3.5 w-3.5" />
        Scan Job Portals
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-card border border-border bg-surface p-6 shadow-2xl">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-4 text-ink-muted hover:text-white"
            >
              <CloseIcon className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5 text-accent">
              <SearchIcon className="h-5 w-5" />
              <h3 className="font-display text-[17px] font-bold text-white">
                Scan Company Job Portals
              </h3>
            </div>
            <p className="mt-1 text-[13px] text-ink-muted">
              JobRadar queries public company ATS endpoints directly (Greenhouse, Lever, etc.) to fetch the latest openings and scores them against your résumé in real-time.
            </p>

            {resultMsg && (
              <div className="mt-4 rounded-[8px] border border-success/30 bg-success/10 p-3 text-[12.5px] font-medium text-success">
                {resultMsg}
              </div>
            )}

            {errorMsg && (
              <div className="mt-4 rounded-[8px] border border-danger/30 bg-danger/10 p-3 text-[12.5px] font-medium text-danger">
                {errorMsg}
              </div>
            )}

            {/* Popular companies toggles */}
            <div className="mt-4">
              <label className="mb-2 block text-[12px] font-semibold text-ink-muted">
                Select company portals to scan:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_POPULAR_COMPANIES.map((c) => {
                  const isSelected = selectedSlugs.includes(c.slug);
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      onClick={() => toggleSlug(c.slug)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold transition ${
                        isSelected
                          ? "border-accent bg-accent/20 text-accent"
                          : "border-border bg-bg text-ink-muted hover:border-border/80"
                      }`}
                    >
                      {isSelected && <CheckIcon className="h-3 w-3" />}
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom company slug input */}
            <div className="mt-4">
              <label className="mb-1.5 block text-[12px] font-semibold text-ink-muted">
                Add another company (Greenhouse board slug):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. linear, discord, figma"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomSlug();
                    }
                  }}
                  className="flex-1 rounded-[8px] border border-border bg-bg px-3 py-1.5 text-[13px] text-white placeholder:text-ink-muted/50 focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addCustomSlug}
                  className="inline-flex items-center gap-1 rounded-[8px] border border-border bg-surface-2 px-3 py-1.5 text-[12.5px] font-semibold text-ink transition hover:border-accent hover:text-accent"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  Add
                </button>
              </div>
              <div className="mt-1 text-[11px] text-ink-muted">
                Tip: Company career URLs like <code>boards.greenhouse.io/&lt;slug&gt;</code> define the slug.
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-[8px] px-3.5 py-1.5 text-[12.5px] font-semibold text-ink-muted hover:text-white"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isScanning || selectedSlugs.length === 0}
                onClick={handleScan}
                className="inline-flex items-center gap-2 rounded-[8px] bg-accent px-4 py-2 text-[13px] font-bold text-accent-ink transition hover:brightness-105 disabled:opacity-50"
              >
                {isScanning ? (
                  <>
                    <RefreshIcon className="h-3.5 w-3.5 animate-spin" />
                    Scanning {selectedSlugs.length} portals...
                  </>
                ) : (
                  <>
                    <SearchIcon className="h-3.5 w-3.5" />
                    Scan Selected Portals ({selectedSlugs.length})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
