"use client";

import { useEffect, useState } from "react";

/**
 * false during server render and until React has hydrated in the browser.
 * Forms disable their submit button until then, so a click can't trigger a
 * native (non-JavaScript) form submission.
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
