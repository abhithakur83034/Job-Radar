"use client";

// Loaded on demand by ScanPortalsButton (next/dynamic) the first time the dialog opens.

import { useEffect, useState, useTransition } from "react";
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


interface CompanyScanResult {
  slug: string;
  source: string | null;
  sourceLabel?: string | null;
  count: number;
  error?: string;
}

// Computed by the backend from live data (boards others follow / with most open jobs)
interface CompanySuggestion {
  slug: string;
  followers: number;
  openJobs: number;
}

export default function ScanPortalsDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([]);
  const [customSlug, setCustomSlug] = useState("");
  const [isScanning, startScan] = useTransition();
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [companyResults, setCompanyResults] = useState<CompanyScanResult[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Esc closes the dialog; the page behind doesn't scroll while it's open
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Load the user's saved company list when the dialog opens
  useEffect(() => {
    fetch("/api/v1/jobs/companies", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const saved: string[] = data?.companies ?? [];
        setCompanies(saved);
        setSelectedSlugs(saved);
        setSuggestions(data?.suggestions ?? []);
      })
      .catch(() => {});
  }, []);

  function toggleSlug(slug: string) {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  function addCompany(slug: string) {
    const clean = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!clean) return;
    setCompanies((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
    setSelectedSlugs((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
    setSuggestions((prev) => prev.filter((s) => s.slug !== clean));
  }

  function addCustomSlug() {
    addCompany(customSlug);
    setCustomSlug("");
  }

  function removeCompany(slug: string) {
    setCompanies((prev) => prev.filter((s) => s !== slug));
    setSelectedSlugs((prev) => prev.filter((s) => s !== slug));
  }

  function handleScan() {
    if (selectedSlugs.length === 0) {
      setErrorMsg("Please select at least one company portal to scan.");
      return;
    }

    setErrorMsg(null);
    setResultMsg(null);
    setCompanyResults([]);

    startScan(async () => {
      try {
        // Remember this selection for next time (best effort)
        await fetch("/api/v1/jobs/companies", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          // Save the full list; unticking a company only skips it for this scan
          body: JSON.stringify({ companies }),
        }).catch(() => {});

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
        const results: CompanyScanResult[] = data.companies ?? [];
        const succeeded = results.filter((c) => !c.error).length;
        setResultMsg(
          `✓ Scan complete: ${data.listingsSeen} listings from ${succeeded} of ${selectedSlugs.length} companies, ${data.newListings ?? 0} new. Found ${data.newMatches} new matches for your profile.`
        );
        setCompanyResults(results);

        router.refresh();
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to scan portals. Please try again.");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(e) => {
        // Click on the backdrop (not inside the panel) closes the dialog
        if (e.target === e.currentTarget && !isScanning) onClose();
      }}
    >
      {/* Capped to the viewport and scrollable inside, so long company lists never push the actions off-screen */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-dialog-title"
        className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-y-auto overscroll-contain rounded-card border border-border bg-surface p-6 pb-0 shadow-2xl"
      >
        <button
          onClick={() => onClose()}
          className="absolute right-4 top-4 text-ink-muted hover:text-ink"
        >
          <CloseIcon className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2.5 text-accent">
          <SearchIcon className="h-5 w-5" />
          <h3 id="scan-dialog-title" className="font-display text-[17px] font-bold text-ink">
            Scan Company Job Portals
          </h3>
        </div>
        <p className="mt-1 text-[13px] text-ink-muted">
          JobRadar queries public company job boards directly (Greenhouse, Lever, Ashby) for their current openings and scores them against your résumé.
        </p>

        {resultMsg && (
          <div className="mt-4 rounded-[8px] border border-success/30 bg-success/10 p-3 text-[12.5px] font-medium text-success">
            {resultMsg}
          </div>
        )}

        {companyResults.length > 0 && (
          <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-[11.5px]">
            {companyResults.map((c) => (
              <li key={c.slug} className={c.error ? "text-danger" : "text-ink-muted"}>
                <span className="font-semibold">{c.slug}</span>
                {c.error
                  ? ` — ${c.error}`
                  : ` — ${c.count} listings via ${c.sourceLabel ?? c.source}`}
              </li>
            ))}
          </ul>
        )}

        {errorMsg && (
          <div className="mt-4 rounded-[8px] border border-danger/30 bg-danger/10 p-3 text-[12.5px] font-medium text-danger">
            {errorMsg}
          </div>
        )}

        {/* Your companies (saved per account) */}
        <div className="mt-4">
          <label className="mb-2 block text-[12px] font-semibold text-ink-muted">
            Your companies — select which to scan:
          </label>
          {companies.length === 0 ? (
            <p className="text-[12px] text-ink-muted">No companies yet. Add one below or pick a suggestion.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {companies.map((slug) => {
                const isSelected = selectedSlugs.includes(slug);
                return (
                  <span
                    key={slug}
                    className={`inline-flex items-center rounded-full border text-[12px] font-semibold transition ${
                      isSelected
                        ? "border-accent bg-accent/20 text-accent"
                        : "border-border bg-bg text-ink-muted hover:border-border/80"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSlug(slug)}
                      aria-pressed={isSelected}
                      className="inline-flex items-center gap-1.5 py-1 pl-3 pr-1.5"
                    >
                      {isSelected && <CheckIcon className="h-3 w-3" />}
                      {slug}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCompany(slug)}
                      aria-label={`Remove ${slug}`}
                      className="py-1 pl-0.5 pr-2.5 hover:text-ink"
                    >
                      <CloseIcon className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="mt-4">
            <label className="mb-2 block text-[12px] font-semibold text-ink-muted">Suggested:</label>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.slice(0, 12).map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => addCompany(s.slug)}
                  title={s.followers > 0 ? `Followed by ${s.followers} user(s)` : undefined}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-bg px-3 py-1 text-[12px] font-semibold text-ink-muted hover:border-accent hover:text-accent"
                >
                  <PlusIcon className="h-3 w-3" />
                  {s.slug}
                  {s.openJobs > 0 && <span className="font-normal opacity-70">· {s.openJobs} open</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Custom company slug input */}
        <div className="mt-4">
          <label className="mb-1.5 block text-[12px] font-semibold text-ink-muted">
            Add another company (Greenhouse, Lever or Ashby slug):
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Enter a company slug"
              value={customSlug}
              onChange={(e) => setCustomSlug(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomSlug();
                }
              }}
              className="flex-1 rounded-[8px] border border-border bg-bg px-3 py-1.5 text-[13px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
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
            Tip: the slug is the company part of its careers URL, e.g. <code>boards.greenhouse.io/&lt;slug&gt;</code>, <code>jobs.lever.co/&lt;slug&gt;</code> or <code>jobs.ashbyhq.com/&lt;slug&gt;</code>.
          </div>
        </div>

        {/* Actions */}
        {/* Stays visible at the bottom while the content above scrolls */}
        <div className="sticky bottom-0 -mx-6 mt-6 flex items-center justify-end gap-3 border-t border-border bg-surface px-6 py-4">
          <button
            type="button"
            onClick={() => onClose()}
            className="rounded-[8px] px-3.5 py-1.5 text-[12.5px] font-semibold text-ink-muted hover:text-ink"
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
  );
}
