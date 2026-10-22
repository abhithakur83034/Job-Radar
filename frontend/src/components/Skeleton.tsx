/** Placeholder blocks shown while a dashboard page's data loads (see app/(dashboard)/loading.tsx). */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[10px] bg-surface-2 ${className}`} />;
}

export function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-start gap-3.5 rounded-card border border-border bg-surface p-4">
          <SkeletonBlock className="h-[38px] w-[38px] flex-none" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-4 w-3/5" />
            <SkeletonBlock className="h-3 w-2/5" />
            <SkeletonBlock className="h-3 w-4/5" />
          </div>
          <SkeletonBlock className="h-12 w-[62px] flex-none" />
        </div>
      ))}
    </div>
  );
}
