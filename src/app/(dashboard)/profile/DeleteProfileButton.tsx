"use client";

import { useState, useTransition } from "react";
import { deleteSearchProfile } from "./actions";

export function DeleteProfileButton({ profileId }: { profileId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="text-right">
      <button
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await deleteSearchProfile(profileId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Couldn't delete this profile.");
            }
          });
        }}
        disabled={isPending}
        className="text-[12px] font-semibold text-danger disabled:opacity-60"
      >
        {isPending ? "Removing…" : "Delete profile"}
      </button>
      {error && <div className="mt-1 text-[11.5px] text-danger">{error}</div>}
    </div>
  );
}
