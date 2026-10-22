"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Types for /api/v1/admin responses (see backend/src/controllers/admin.controller.js)

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paged<T> {
  items: T[];
  pagination: Pagination;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  username: string | null;
  mobile: string | null; // masked by the server
  role: "user" | "admin";
  status: "active" | "suspended";
  createdAt: string;
  lastActiveAt: string | null;
}

export interface AdminJobRow {
  id: string;
  title: string;
  company: string;
  location: string;
  source: string;
  status: "open" | "closed" | "hidden";
  foundAt: string | null;
  lastSeenAt: string | null;
  postedAt: string | null;
}

export interface RefreshRun {
  id: string;
  trigger: string;
  status: "running" | "completed" | "partial" | "failed";
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  providers: { id: string; status: string; fetched?: number; error?: string }[];
  newListings: number;
  newMatches: number;
  closedJobs: number;
  error: string | null;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

/** fetch() for same-origin admin API calls; throws ApiError with the server's message. */
export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error || `Request failed (HTTP ${res.status})`, res.status, body.code);
  return body as T;
}

export function toQuery(params: Record<string, string | number | undefined | null>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

/**
 * Loads `path` and reloads when it changes. Stale responses are ignored when the
 * path changes quickly (e.g. while typing a search), and only one request per path runs.
 */
export function useAdminData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const latest = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const id = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const result = await adminFetch<T>(path);
      if (id === latest.current) setData(result);
    } catch (err) {
      if (id === latest.current) setError(err instanceof ApiError ? err : new ApiError("Network error", 0));
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load };
}

/** Debounced value, so search inputs don't fire a request per keystroke. */
export function useDebounced<T>(value: T, delayMs = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatDuration(ms: number | null | undefined) {
  if (ms === null || ms === undefined) return "—";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}
