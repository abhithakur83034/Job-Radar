"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { rules } from "@/lib/validation";
import { FormField, TextInput } from "@/components/forms/FormField";
import { revalidateDashboard, updateAccountDetails } from "./actions";

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  active_search: "Active Search",
  career_boost: "Career Boost",
};

interface AccountValues {
  name: string;
  username: string;
  mobile: string;
}

export function AccountDetailsCard({
  initialName,
  username,
  mobile,
  email,
  plan,
  avatarUrl,
  memberSince,
}: {
  initialName: string;
  username: string | null;
  mobile: string | null;
  email: string;
  plan: string;
  avatarUrl: string | null;
  memberSince: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState(avatarUrl);
  const [isUploading, startUpload] = useTransition();
  const [saved, setSaved] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<AccountValues>({
    mode: "onTouched",
    defaultValues: { name: initialName, username: username ?? "", mobile: mobile ?? "" },
  });

  async function onSubmit(values: AccountValues) {
    const result = await updateAccountDetails({
      name: values.name.trim(),
      // Optional for older accounts until they choose to set them
      ...(values.username.trim() ? { username: values.username.trim() } : {}),
      ...(values.mobile.trim() ? { mobile: values.mobile.trim() } : {}),
    });
    if (!result.ok) {
      const field = /username/i.test(result.error) ? "username" : /mobile/i.test(result.error) ? "mobile" : "root";
      setError(field, { message: result.error });
      return;
    }
    reset(values);
    router.refresh();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function onAvatarSelected(file: File) {
    setAvatarError(null);
    startUpload(async () => {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch("/api/v1/upload/avatar", { method: "POST", body: formData, credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAvatarError(data.error || "Couldn't upload that image — try a different file.");
        return;
      }
      setAvatar(data.avatarUrl);
      await revalidateDashboard();
      router.refresh();
    });
  }

  const initials = watch("name")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="rounded-card border border-border bg-surface p-6">
      <h2 className="text-[15px] font-bold">Your profile</h2>
      <p className="mt-0.5 text-[12.5px] text-ink-muted">Your account details, visible only to you.</p>

      <div className="mt-4 flex flex-wrap items-start gap-5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isUploading}
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
            {isUploading ? "Uploading…" : "Change"}
          </div>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAvatarSelected(file);
            e.target.value = "";
          }}
        />

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex min-w-[220px] flex-1 flex-col gap-3"
        >
          <FormField label="Name" htmlFor="account-name" error={errors.name}>
            <TextInput id="account-name" autoComplete="name" placeholder="Enter your full name" error={errors.name} {...register("name", rules.name)} />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              label="Username"
              htmlFor="account-username"
              error={errors.username}
              hint={username ? undefined : "Set one to sign in without your email"}
            >
              <TextInput
                id="account-username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="Choose a username"
                error={errors.username}
                {...register("username", { ...rules.username, required: false })}
              />
            </FormField>
            <FormField label="Mobile number" htmlFor="account-mobile" error={errors.mobile}>
              <TextInput
                id="account-mobile"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="Enter your mobile number"
                error={errors.mobile}
                {...register("mobile", {
                  validate: (v) => !v.trim() || rules.mobile.validate(v),
                })}
              />
            </FormField>
          </div>

          {errors.root && <p role="alert" className="text-[11.5px] text-danger">{errors.root.message}</p>}

          <div>
            <button
              type="submit"
              disabled={isSubmitting || !isDirty}
              className="rounded-[9px] bg-sidebar px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {isSubmitting ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-[12.5px]">
            <div className="min-w-0">
              <div className="text-ink-muted">Email</div>
              <div className="mt-0.5 break-all font-medium">{email}</div>
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
        </form>
      </div>

      {avatarError && <div role="alert" className="mt-3 text-[11.5px] text-danger">{avatarError}</div>}
    </div>
  );
}
