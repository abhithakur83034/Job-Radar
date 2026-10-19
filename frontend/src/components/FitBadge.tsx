export function FitBadge({ score, size = "md" }: { score: number; size?: "md" | "sm" }) {
  const strong = score >= 85;
  const good = score >= 65 && score < 85;

  const colorClasses = strong
    ? "bg-success-bg text-success"
    : good
      ? "bg-accent-soft text-accent-soft-ink"
      : "bg-surface-2 text-ink-muted";

  const label = strong ? "Strong" : good ? "Good" : "Low";

  if (size === "sm") {
    return (
      <span className={`mono inline-block rounded-[10px] px-2.5 py-1 text-[13px] font-bold ${colorClasses}`}>
        {score}%
      </span>
    );
  }

  return (
    <div className={`mono min-w-[62px] flex-none rounded-[11px] px-3 py-2 text-center text-[17px] font-bold ${colorClasses}`}>
      {score}%
      <span className="mt-0.5 block font-body text-[9px] font-semibold uppercase tracking-wide opacity-85">
        {label}
      </span>
    </div>
  );
}
