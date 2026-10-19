const STYLES: Record<string, string> = {
  applied: "bg-info-bg text-info",
  interviewing: "bg-accent-soft text-accent-soft-ink",
  followup: "bg-danger-bg text-danger",
  offer: "bg-success-bg text-success",
  rejected: "bg-surface-2 text-ink-muted",
};

const LABELS: Record<string, string> = {
  applied: "Applied",
  interviewing: "Interviewing",
  followup: "Follow-up due",
  offer: "Offer",
  rejected: "Rejected",
};

export function StatusPill({ status }: { status: string }) {
  const cls = STYLES[status] ?? STYLES.applied;
  const label = LABELS[status] ?? status;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold before:h-1.5 before:w-1.5 before:rounded-full before:bg-current ${cls}`}>
      {label}
    </span>
  );
}
