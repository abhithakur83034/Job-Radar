"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { replaceResume } from "./actions";

export function ReplaceResumeButton({ userId }: { userId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
        className="mt-3 rounded-[9px] border border-border px-3 py-1.5 text-[12px] font-semibold disabled:opacity-60"
      >
        {isPending ? "Updating…" : "Replace résumé"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          startTransition(async () => {
            await replaceResume(userId, file.name);
            router.refresh();
          });
        }}
      />
      <p className="mt-2 text-[11px] text-ink-muted">
        Updates the file on record — automatic skill re-extraction lands in a later build phase.
      </p>
    </>
  );
}
