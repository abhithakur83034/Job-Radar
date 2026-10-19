"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAccountDetails } from "./actions";

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  active_search: "Active Search",
  career_boost: "Career Boost",
};

function resizeToDataUrl(file: File, maxSize = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AccountDetailsCard({
  userId,
  initialName,
  email,
  plan,
  avatarUrl,
  memberSince,
}: {
  userId: string;
  initialName: string;
  email: string;
  plan: string;
  avatarUrl: string | null;
  memberSince: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState(avatarUrl);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function saveName() {
    startTransition(async () => {
      await updateAccountDetails(userId, { name });
      router.refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  async function onAvatarSelected(file: File) {
    setError(null);
    try {
      const dataUrl = await resizeToDataUrl(file);
      setAvatar(dataUrl);
      startTransition(async () => {
        await updateAccountDetails(userId, { avatarUrl: dataUrl });
        router.refresh();
      });
    } catch {
      setError("Couldn't read that image — try a different file.");
    }
  }

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="rounded-card border border-border bg-surface p-6">
      <h2 className="text-[15px] font-bold">Your profile</h2>
      <p className="mt-0.5 text-[12.5px] text-ink-muted">Your account details, visible only to you.</p>

      <div className="mt-4 flex flex-wrap items-center gap-5">
        <button
          onClick={() => fileRef.current?.click()}
          className="group relative h-20 w-20 flex-none overflow-hidden rounded-full border border-border"
          aria-label="Change profile photo"
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-accent font-display text-2xl font-bold text-accent-ink">
              {initials || "?"}
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
            Change
          </div>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAvatarSelected(file);
          }}
        />

        <div className="flex min-w-[220px] flex-1 flex-col gap-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1.5 block text-[12px] font-semibold text-ink-muted">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-[9px] border border-border bg-bg px-3 py-2 text-[13.5px]"
              />
            </div>
            <button
              onClick={saveName}
              disabled={isPending || name === initialName}
              className="rounded-[9px] bg-sidebar px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {isPending ? "Saving…" : saved ? "Saved ✓" : "Save"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[12.5px]">
            <div>
              <div className="text-ink-muted">Email</div>
              <div className="mt-0.5 font-medium">{email}</div>
            </div>
            <div>
              <div className="text-ink-muted">Plan</div>
              <div className="mt-0.5 font-medium">{PLAN_LABELS[plan] ?? plan}</div>
            </div>
            <div>
              <div className="text-ink-muted">Member since</div>
              <div className="mt-0.5 font-medium">{memberSince}</div>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="mt-3 text-[11.5px] text-danger">{error}</div>}
    </div>
  );
}
