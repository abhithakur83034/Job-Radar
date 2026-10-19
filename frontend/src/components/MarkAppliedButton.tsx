"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MarkAppliedButton({ matchId, alreadyApplied }: { matchId: string; alreadyApplied: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (alreadyApplied) {
    return (
      <span className="rounded-[9px] border border-success bg-success-bg px-4 py-2 text-[13px] font-semibold text-success">
        ✓ Marked applied
      </span>
    );
  }

  return (
    <button
      onClick={async () => {
        setLoading(true);
        await fetch("/api/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId }),
        });
        router.refresh();
        setLoading(false);
      }}
      disabled={loading}
      className="rounded-[9px] border border-border bg-surface px-4 py-2 text-[13px] font-semibold disabled:opacity-60"
    >
      {loading ? "Marking…" : "Mark as applied"}
    </button>
  );
}
