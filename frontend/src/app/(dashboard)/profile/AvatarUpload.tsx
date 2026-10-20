"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { updateUserAvatar } from "./actions";

export function AvatarUpload({
  userId,
  userName,
  initialAvatarUrl,
}: {
  userId: string;
  userName: string;
  initialAvatarUrl: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size exceeds the 5MB limit.");
      return;
    }

    // Validate type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      setError("Please select a JPEG, PNG, WEBP, or GIF image.");
      return;
    }

    try {
      setIsUploading(true);

      // Instant optimistic local preview
      const localPreview = URL.createObjectURL(file);
      setAvatarUrl(localPreview);

      // Upload using Multer backend API
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await apiRequest<{ success: boolean; avatarUrl: string }>(
        "/api/v1/upload/avatar",
        {
          method: "POST",
          body: formData,
        }
      );

      if (res.avatarUrl) {
        setAvatarUrl(res.avatarUrl);
        setSuccess("✓ Profile photo updated successfully");

        // Revalidate UI to reflect updated avatar across dashboard pages
        startTransition(async () => {
          await updateUserAvatar(userId, res.avatarUrl);
          router.refresh();
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image.");
      setAvatarUrl(initialAvatarUrl);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative group">
        <div
          onClick={() => fileInputRef.current?.click()}
          className="relative flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-border bg-surface-2 shadow-sm transition hover:border-accent"
          title="Click to change profile photo"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={userName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-accent font-display text-[18px] font-bold text-accent-ink">
              {initials || "?"}
            </div>
          )}

          {/* Hover overlay with camera icon */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-5 w-5 text-white"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload photo"
          className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-ink shadow transition hover:scale-110"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            className="h-3.5 w-3.5"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[14.5px] text-ink">{userName}</span>
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10.5px] font-bold text-accent">
            CANDIDATE
          </span>
        </div>
        <div className="mt-0.5 text-[12px] text-ink-muted">
          {isUploading ? (
            <span className="text-accent animate-pulse font-medium">
              Uploading & processing image…
            </span>
          ) : error ? (
            <span className="text-danger font-medium">{error}</span>
          ) : success ? (
            <span className="text-success font-medium">{success}</span>
          ) : (
            <span>Click photo to upload PNG, JPG, or WEBP (max 5MB)</span>
          )}
        </div>
      </div>
    </div>
  );
}

