"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { apiRequest } from "@/lib/api";
import { rules } from "@/lib/validation";
import { useHydrated } from "@/lib/useHydrated";
import { FormField, PasswordInput, TextInput } from "@/components/forms/FormField";

interface RegisterValues {
  name: string;
  username: string;
  mobile: string;
  email: string;
  password: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const hydrated = useHydrated();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    // No defaultValues: keeps anything typed before hydration (see login page)
  } = useForm<RegisterValues>({ mode: "onTouched" });

  async function onSubmit(values: RegisterValues) {
    setError(null);
    try {
      await apiRequest("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: (values.name ?? "").trim(),
          username: (values.username ?? "").trim(),
          mobile: (values.mobile ?? "").trim(),
          email: (values.email ?? "").trim(),
          password: values.password,
        }),
      });
      // Redirect to onboarding for new account setup
      router.replace("/onboarding");
    } catch (err: any) {
      setError(err.message || "Failed to create account");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-[440px] rounded-card border border-border bg-surface p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent shadow-[0_0_0_4px_var(--accent-soft)]">
            <span className="h-2.5 w-2.5 rounded-full bg-accent-ink" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">Get started with JobRadar</h1>
          <p className="mt-1 text-[13px] text-ink-muted">Set up your multi-user job intelligence dashboard</p>
        </div>

        {error && (
          <div role="alert" className="mb-5 rounded-[9px] border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[12.5px] text-danger">
            {error}
          </div>
        )}

        {/* method="post": if submitted before JavaScript loads, credentials never go into the URL */}
        <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <FormField label="Full name" htmlFor="name" error={errors.name}>
            <TextInput
              id="name"
              autoFocus
              autoComplete="name"
              placeholder="Enter your full name"
              error={errors.name}
              {...register("name", rules.name)}
            />
          </FormField>

          <FormField
            label="Username"
            htmlFor="username"
            error={errors.username}
            hint="You'll sign in with this. Letters, numbers, dots or underscores."
          >
            <TextInput
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Choose a username"
              error={errors.username}
              {...register("username", rules.username)}
            />
          </FormField>

          <FormField
            label="Mobile number"
            htmlFor="mobile"
            error={errors.mobile}
            hint="You can also sign in with this. Indian numbers don't need +91."
          >
            <TextInput
              id="mobile"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="Enter your mobile number"
              error={errors.mobile}
              {...register("mobile", rules.mobile)}
            />
          </FormField>

          <FormField label="Email address" htmlFor="email" error={errors.email}>
            <TextInput
              id="email"
              type="email"
              autoComplete="email"
              placeholder="Enter your email address"
              error={errors.email}
              {...register("email", rules.email)}
            />
          </FormField>

          <FormField label="Password (min 8 characters)" htmlFor="password" error={errors.password}>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder="Create a password"
              error={errors.password}
              {...register("password", rules.newPassword)}
            />
          </FormField>

          <button
            type="submit"
            disabled={isSubmitting || !hydrated}
            className="mt-2 flex w-full items-center justify-center rounded-[9px] bg-accent px-4 py-2.5 text-[13.5px] font-bold text-accent-ink transition hover:opacity-95 disabled:opacity-50"
          >
            {isSubmitting ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <div className="mt-6 border-t border-border pt-5 text-center text-[12.5px] text-ink-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
