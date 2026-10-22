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

interface CompanyScanResult {
  slug: string;
  source: string | null;
  count: number;
  error?: string;
}

const SOURCE_LABELS: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
};

export default function ScanPortalsDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [customCompanies, setCustomCompanies] = useState<string[]>([]);
  const [customSlug, setCustomSlug] = useState("");
  const [isScanning, startScan] = useTransition();
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [companyResults, setCompanyResults] = useState<CompanyScanResult[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load the user's saved company list when the dialog opens
  useEffect(() => {
    fetch("/api/v1/jobs/companies", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const saved: string[] = data?.companies ?? [];
        setSelectedSlugs(saved);
        setCustomCompanies(
          saved.filter((slug) => !DEFAULT_POPULAR_COMPANIES.some((c) => c.slug === slug))
        );
      })
      .catch(() => {});
  }, []);

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
    if (
      !customCompanies.includes(clean) &&
      !DEFAULT_POPULAR_COMPANIES.some((c) => c.slug === clean)
    ) {
      setCustomCompanies((prev) => [...prev, clean]);
    }
    setCustomSlug("");
  }

  function removeCustomSlug(slug: string) {
    setCustomCompanies((prev) => prev.filter((s) => s !== slug));
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
          body: JSON.stringify({ companies: selectedSlugs }),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-card border border-border bg-surface p-6 shadow-2xl">
        <button
          onClick={() => onClose()}
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
                  : ` — ${c.count} listings via ${SOURCE_LABELS[c.source ?? ""] ?? c.source}`}
              </li>
            ))}
          </ul>
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
            {customCompanies.map((slug) => {
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
                    className="inline-flex items-center gap-1.5 py-1 pl-3 pr-1.5"
                  >
                    {isSelected && <CheckIcon className="h-3 w-3" />}
                    {slug}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCustomSlug(slug)}
                    aria-label={`Remove ${slug}`}
                    className="py-1 pl-0.5 pr-2.5 hover:text-white"
                  >
                    <CloseIcon className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>

        {/* Custom company slug input */}
        <div className="mt-4">
          <label className="mb-1.5 block text-[12px] font-semibold text-ink-muted">
            Add another company (Greenhouse, Lever or Ashby slug):
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. discord, palantir, linear"
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
            Tip: the slug is the company part of its careers URL, e.g. <code>boards.greenhouse.io/&lt;slug&gt;</code>, <code>jobs.lever.co/&lt;slug&gt;</code> or <code>jobs.ashbyhq.com/&lt;slug&gt;</code>.
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => onClose()}
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
  );
}
