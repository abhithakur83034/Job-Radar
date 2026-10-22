"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";

// The dialog (company list, scan logic) is a separate chunk, fetched only when opened
const ScanPortalsDialog = dynamic(() => import("./ScanPortalsDialog"), { ssr: false });

function SearchIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

export function ScanPortalsButton() {
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-[9px] border border-accent bg-accent/20 px-3.5 py-2 text-[12.5px] font-bold text-accent transition hover:bg-accent hover:text-accent-ink"
      >
        <SearchIcon className="h-3.5 w-3.5" />
        Scan Job Portals
      </button>

      {isOpen && <ScanPortalsDialog onClose={close} />}
    </>
  );
}
