const FOLLOWUP_AFTER_DAYS = 7;

export function daysSince(date: Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

// "7.4 Follow-Up Tracking Workflow — STEP 2: if no status update after a
// configurable period (e.g., 7 days), JobRadar reminds the user."
export function isFollowUpDue(app: { status: string; lastUpdateAt: Date }): boolean {
  return app.status === "applied" && daysSince(app.lastUpdateAt) >= FOLLOWUP_AFTER_DAYS;
}

export function displayStatus(app: { status: string; lastUpdateAt: Date }): string {
  return isFollowUpDue(app) ? "followup" : app.status;
}
