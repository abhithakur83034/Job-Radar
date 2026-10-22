/** Source display names, served by the backend (GET /api/v1/job-sources → labels). */
export type SourceLabels = Record<string, string>;

/** Display name for a source id; falls back to the id itself if the backend didn't label it. */
export function sourceLabel(source: string, labels?: SourceLabels): string {
  return labels?.[source] ?? source;
}

export interface JobSourceStatus {
  id: string;
  displayName: string;
  homepage: string;
  requiresKey: boolean;
  configured: boolean;
  refreshEveryMinutes: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastStatus: "success" | "failed" | null;
  lastFetched: number;
}
