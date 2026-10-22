"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { apiRequest } from "@/lib/api";
import { useHydrated } from "@/lib/useHydrated";
import { FormField, TextInput } from "@/components/forms/FormField";
import { ThemeToggle } from "@/components/ThemeToggle";

interface ForgotValues {
  identifier: string;
}

export default function ForgotPasswordPage() {
  const hydrated = useHydrated();
  const [sent, setSent] = useState<{ message: string; emailEnabled: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>();

  async function onSubmit(values: ForgotValues) {
    setError(null);
    try {
      const res = await apiRequest<{ message: string; emailEnabled: boolean }>("/api/v1/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ identifier: (values.identifier ?? "").trim() }),
      });
      setSent(res);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg p-4 sm:p-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-[420px] rounded-card border border-border bg-surface p-6 shadow-xl sm:p-8">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Forgot your password?</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          Enter your username, mobile number or email. We&apos;ll email a link to reset it.
        </p>

        {sent ? (
          <div role="status" className="mt-5 space-y-2 rounded-[9px] border border-success/30 bg-success/10 px-3.5 py-3 text-[12.5px] text-success">
            <p>{sent.message}</p>
            <p className="text-ink-muted">The link works once and expires in 30 minutes. Check your spam folder too.</p>
            {!sent.emailEnabled && (
              <p className="text-ink-muted">
                Email delivery isn&apos;t set up on this server yet. Ask an administrator to send you a reset link.
              </p>
            )}
          </div>
        ) : (
          <>
            {error && (
              <div role="alert" className="mt-5 rounded-[9px] border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[12.5px] text-danger">
                {error}
              </div>
            )}
            <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 flex flex-col gap-4">
              <FormField label="Username, mobile number or email" htmlFor="identifier" error={errors.identifier}>
                <TextInput
                  id="identifier"
                  autoFocus
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="Enter your username, mobile number or email"
                  error={errors.identifier}
                  {...register("identifier", { required: "Enter your username, mobile number or email" })}
                />
              </FormField>
              <button
                type="submit"
                disabled={isSubmitting || !hydrated}
                className="flex w-full items-center justify-center rounded-[9px] bg-accent px-4 py-2.5 text-[13.5px] font-bold text-accent-ink transition hover:opacity-95 disabled:opacity-50"
              >
                {isSubmitting ? "Sending…" : "Send reset link"}
              </button>
            </form>
          </>
        )}

        <div className="mt-6 border-t border-border pt-5 text-center text-[12.5px] text-ink-muted">
          Remembered it?{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
