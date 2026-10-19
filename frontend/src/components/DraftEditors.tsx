"use client";

import { useState } from "react";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-[7px] border border-border px-2.5 py-1 text-[11.5px] font-semibold"
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

export function DraftEditors({
  initialResume,
  initialCoverLetter,
}: {
  initialResume: string;
  initialCoverLetter: string;
}) {
  const [resume, setResume] = useState(initialResume);
  const [coverLetter, setCoverLetter] = useState(initialCoverLetter);

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11.5px] font-bold uppercase tracking-wide text-ink-muted">
            Final résumé (editable)
          </span>
          <CopyButton text={resume} />
        </div>
        <textarea
          value={resume}
          onChange={(e) => setResume(e.target.value)}
          rows={10}
          className="mono w-full resize-y rounded-card border border-border bg-surface p-4 text-[12.5px] leading-relaxed"
        />
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11.5px] font-bold uppercase tracking-wide text-ink-muted">
            Cover letter (editable)
          </span>
          <CopyButton text={coverLetter} />
        </div>
        <textarea
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value)}
          rows={10}
          className="mono w-full resize-y rounded-card border border-border bg-surface p-4 text-[12.5px] leading-relaxed"
        />
      </div>
    </div>
  );
}
