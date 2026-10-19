"use client";

import { useState } from "react";

/**
 * For actions that are genuinely not implemented yet (billing/Stripe —
 * doc build Phase 6) rather than silently doing nothing on click, which
 * reads as broken. Clicking reveals why, instead of nothing happening.
 */
export function ComingSoonButton({
  children,
  note,
  className,
}: {
  children: React.ReactNode;
  note: string;
  className?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => {
          setShow(true);
          setTimeout(() => setShow(false), 3000);
        }}
        className={className}
      >
        {children}
      </button>
      {show && (
        <div className="absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-[9px] border border-border bg-surface p-2.5 text-center text-[11.5px] text-ink-muted shadow-lg">
          {note}
        </div>
      )}
    </div>
  );
}
