"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { apiRequest } from "@/lib/api";
import { rules } from "@/lib/validation";
import { useHydrated } from "@/lib/useHydrated";
import { FormField, PasswordInput, TextInput } from "@/components/forms/FormField";

interface LoginValues {
  identifier: string;
  password: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const hydrated = useHydrated();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    // No defaultValues: react-hook-form then adopts whatever is already in the inputs,
    // so text typed before hydration (slow phones) isn't wiped when the form mounts.
  } = useForm<LoginValues>();

  async function onSubmit(values: LoginValues) {
    setError(null);
    try {
      await apiRequest("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier: (values.identifier ?? "").trim(), password: values.password }),
      });
      // replace (not push + refresh): one fresh load of the feed, and Back doesn't return to login
      router.replace("/feed");
    } catch (err: any) {
      setError(err.message || "Failed to sign in");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-[420px] rounded-card border border-border bg-surface p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent shadow-[0_0_0_4px_var(--accent-soft)]">
            <span className="h-2.5 w-2.5 rounded-full bg-accent-ink" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">Welcome back</h1>
          <p className="mt-1 text-[13px] text-ink-muted">Sign in to your JobRadar account</p>
        </div>

        {error && (
          <div role="alert" className="mb-5 rounded-[9px] border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[12.5px] text-danger">
            {error}
          </div>
        )}

        {/* method="post": if submitted before JavaScript loads, credentials never go into the URL */}
        <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <FormField
            label="Username or mobile number"
            htmlFor="identifier"
            error={errors.identifier}
            hint="Older accounts can still sign in with their email."
          >
            <TextInput
              id="identifier"
              type="text"
              autoFocus
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Enter your username or mobile number"
              error={errors.identifier}
              {...register("identifier", rules.identifier)}
            />
          </FormField>

          <FormField label="Password" htmlFor="password" error={errors.password}>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              error={errors.password}
              {...register("password", rules.password)}
            />
          </FormField>

          <button
            type="submit"
            disabled={isSubmitting || !hydrated}
            className="mt-2 flex w-full items-center justify-center rounded-[9px] bg-accent px-4 py-2.5 text-[13.5px] font-bold text-accent-ink transition hover:opacity-95 disabled:opacity-50"
          >
            {isSubmitting ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div className="mt-6 border-t border-border pt-5 text-center text-[12.5px] text-ink-muted">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-semibold text-accent hover:underline">
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
