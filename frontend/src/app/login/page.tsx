"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await apiRequest("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/feed");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to sign in");
    } finally {
      setLoading(false);
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
          <div className="mb-5 rounded-[9px] border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[12.5px] text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-ink-muted">Email address</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-[9px] border border-border bg-bg px-3.5 py-2.5 text-[13.5px] text-white placeholder:text-ink-muted/50 focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[12px] font-semibold text-ink-muted">Password</label>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-[9px] border border-border bg-bg px-3.5 py-2.5 text-[13.5px] text-white placeholder:text-ink-muted/50 focus:border-accent focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center rounded-[9px] bg-accent px-4 py-2.5 text-[13.5px] font-bold text-accent-ink transition hover:opacity-95 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign In"}
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

