"use client";

// Shown when a page fails to render, most often because the API was unreachable
// (restarting, or the free host waking up). Retrying usually works a moment later.
export default function ErrorPage(_props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4 sm:p-6">
      <div className="w-full max-w-[420px] rounded-card border border-border bg-surface p-6 text-center shadow-xl sm:p-8">
        <h1 className="font-display text-xl font-bold tracking-tight text-ink">Something went wrong</h1>
        <p className="mt-2 text-[13px] text-ink-muted">
          We couldn&apos;t load this page. The JobRadar server may be starting up. Please try again in a moment.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            // A full reload re-runs the server-side checks; reset() alone only re-renders on the client
            onClick={() => window.location.reload()}
            className="rounded-[9px] bg-accent px-4 py-2.5 text-[13.5px] font-bold text-accent-ink transition hover:opacity-95"
          >
            Try again
          </button>
          <a
            href="/login"
            className="rounded-[9px] border border-border px-4 py-2.5 text-[13.5px] font-semibold text-ink hover:bg-surface-2"
          >
            Go to sign in
          </a>
        </div>
      </div>
    </div>
  );
}
