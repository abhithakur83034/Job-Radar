"use client";

import { useState, useEffect } from "react";

export function ViewResumeModal({
  fileName,
  resumeUrl,
}: {
  fileName: string;
  resumeUrl?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const viewUrl = resumeUrl || "/api/v1/resumes/view/latest";
  const downloadUrl = "/api/v1/resumes/download/latest";

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-[8px] border border-border bg-surface-2 px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:border-accent hover:text-accent-soft-ink"
        title="Preview your uploaded résumé"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="h-3.5 w-3.5 text-accent"
        >
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        View résumé
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative flex h-[90vh] w-full max-w-[850px] flex-col rounded-card border border-border bg-surface shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/15 text-[11px] font-bold text-accent">
                  PDF
                </span>
                <div className="truncate font-display text-[14.5px] font-bold text-ink">
                  {fileName || "Candidate Résumé"}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-[7px] border border-border bg-surface-2 px-2.5 py-1 text-[11.5px] font-medium text-ink transition hover:border-accent hover:text-accent-soft-ink"
                  title="Open in a dedicated browser tab"
                >
                  Open in new tab ↗
                </a>
                <a
                  href={downloadUrl}
                  download={fileName || "resume.pdf"}
                  className="inline-flex items-center gap-1 rounded-[7px] border border-border bg-surface-2 px-2.5 py-1 text-[11.5px] font-medium text-ink transition hover:border-accent hover:text-accent-soft-ink"
                  title="Download file to your device"
                >
                  Download ⬇
                </a>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="ml-1 text-xl leading-none text-ink-muted transition hover:text-ink"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Embedded PDF Viewer */}
            <div className="flex-1 overflow-hidden bg-bg/70 p-2">
              <iframe
                src={viewUrl}
                title="Résumé Document Preview"
                className="h-full w-full rounded border-0 bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

