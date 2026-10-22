"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { apiRequest } from "@/lib/api";
import { rules } from "@/lib/validation";
import { useHydrated } from "@/lib/useHydrated";
import { FormField, PasswordInput } from "@/components/forms/FormField";
import { ThemeToggle } from "@/components/ThemeToggle";

interface ResetValues {
  password: string;
  confirm: string;
}

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({ mode: "onTouched" });

  async function onSubmit(values: ResetValues) {
    setError(null);
    try {
      await apiRequest("/api/v1/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password: values.password }),
      });
      setDone(true);
      setTimeout(() => router.replace("/login"), 2500);
    } catch (err: any) {
      setError(err.message || "Couldn't reset your password.");
    }
  }

  if (!token) {
    return (
      <p role="alert" className="mt-5 text-[13px] text-danger">
        This reset link is incomplete. Please use the link from your email, or{" "}
        <Link href="/forgot-password" className="font-semibold underline">request a new one</Link>.
      </p>
    );
  }

  if (done) {
    return (
      <p role="status" className="mt-5 rounded-[9px] border border-success/30 bg-success/10 px-3.5 py-3 text-[13px] text-success">
        Password updated. You&apos;ve been signed out everywhere; taking you to sign in…
      </p>
    );
  }

  return (
    <>
      {error && (
        <div role="alert" className="mt-5 rounded-[9px] border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[12.5px] text-danger">
          {error}{" "}
          <Link href="/forgot-password" className="font-semibold underline">Request a new link</Link>
        </div>
      )}
      <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 flex flex-col gap-4">
        <FormField label="New password (min 8 characters)" htmlFor="password" error={errors.password}>
          <PasswordInput
            id="password"
            autoFocus
            autoComplete="new-password"
            placeholder="Create a new password"
            error={errors.password}
            {...register("password", rules.newPassword)}
          />
        </FormField>
        <FormField label="Confirm new password" htmlFor="confirm" error={errors.confirm}>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            placeholder="Type the new password again"
            error={errors.confirm}
            {...register("confirm", {
              required: "Please confirm your new password",
              validate: (v) => v === getValues("password") || "Passwords don't match",
            })}
          />
        </FormField>
        <button
          type="submit"
          disabled={isSubmitting || !hydrated}
          className="flex w-full items-center justify-center rounded-[9px] bg-accent px-4 py-2.5 text-[13.5px] font-bold text-accent-ink transition hover:opacity-95 disabled:opacity-50"
        >
          {isSubmitting ? "Saving…" : "Set new password"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg p-4 sm:p-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-[420px] rounded-card border border-border bg-surface p-6 shadow-xl sm:p-8">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Set a new password</h1>
        <p className="mt-1 text-[13px] text-ink-muted">Choose a password you don&apos;t use anywhere else.</p>
        {/* useSearchParams needs a Suspense boundary for static rendering */}
        <Suspense fallback={<div className="mt-5 h-40 animate-pulse rounded-[9px] bg-surface-2" />}>
          <ResetPasswordForm />
        </Suspense>
        <div className="mt-6 border-t border-border pt-5 text-center text-[12.5px] text-ink-muted">
          <Link href="/login" className="font-semibold text-accent hover:underline">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
