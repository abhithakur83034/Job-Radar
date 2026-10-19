"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DraftGenerateButton({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/drafts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to generate draft");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-card border border-dashed border-border p-8 text-center">
      <div className="mb-3 text-ink-muted">No tailored draft yet for this match.</div>
      <button
        onClick={generate}
        disabled={loading}
        className="rounded-[9px] bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink disabled:opacity-60"
      >
        {loading ? "Generating…" : "Generate tailored draft"}
      </button>
      {error && <div className="mt-2 text-[12px] text-danger">{error}</div>}
    </div>
  );
}
