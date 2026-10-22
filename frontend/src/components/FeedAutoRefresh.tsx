"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const STALE_AFTER_MS = 5 * 60 * 1000;

/**
 * Re-fetches the feed when you come back to the tab after 5+ minutes away, so new
 * openings found by the background refresh appear without a manual reload.
 * No polling while the tab is open or hidden.
 */
export function FeedAutoRefresh() {
  const router = useRouter();
  const loadedAt = useRef(Date.now());

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && Date.now() - loadedAt.current > STALE_AFTER_MS) {
        loadedAt.current = Date.now();
        router.refresh();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  return null;
}
