// Display names for every job source (mirrors backend providerRegistry SOURCE_LABELS).
// Sources' terms require crediting them by name and linking back to their job page.
export const SOURCE_LABELS: Record<string, string> = {
  remotive: "Remotive",
  remoteok: "Remote OK",
  jobicy: "Jobicy",
  themuse: "The Muse",
  adzuna: "Adzuna",
  jooble: "Jooble",
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  linkedin: "LinkedIn alert",
  naukri: "Naukri alert",
  indeed: "Indeed alert",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
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
