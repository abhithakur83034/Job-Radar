"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition, useState } from "react";
import { apiRequest } from "@/lib/api";

export function ReplaceResumeButton({
  userId: _userId,
  hasResume = false,
}: {
  userId: string;
  hasResume?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleFileUpload(file: File) {
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // 1. Upload the real binary file via Multer to backend storage & MongoDB
      const formData = new FormData();
      formData.append("resume", file);

      await apiRequest("/api/v1/resumes/upload", {
        method: "POST",
        body: formData,
      });

      // 2. Revalidate and refresh UI
      startTransition(() => {
        setSuccessMsg(`✓ ${file.name} uploaded and parsed successfully`);
        router.refresh();
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to upload résumé file.");
    }
  }

  return (
    <div className="mt-4">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
        className={`w-full rounded-[9px] border border-border px-4 py-2 text-[12.5px] font-semibold transition-colors disabled:opacity-60 ${
          hasResume
            ? "bg-surface-2 text-ink hover:border-accent hover:text-accent-soft-ink"
            : "bg-accent text-accent-ink hover:opacity-90"
        }`}
      >
        {isPending
          ? "Uploading & extracting skills…"
          : hasResume
          ? "Replace résumé"
          : "Upload résumé"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          handleFileUpload(file);
        }}
      />
      {errorMsg ? (
        <p className="mt-2 text-[11.5px] font-medium text-danger animate-fade-in">
          {errorMsg}
        </p>
      ) : successMsg ? (
        <p className="mt-2 text-[11.5px] font-medium text-success animate-fade-in">
          {successMsg}
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-ink-muted">
          Supported formats: PDF or DOCX. Skills and roles are automatically refreshed.
        </p>
      )}
    </div>
  );
}
