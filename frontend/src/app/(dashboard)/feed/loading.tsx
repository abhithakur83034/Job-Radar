import { CardListSkeleton, SkeletonBlock } from "@/components/Skeleton";

export default function FeedLoading() {
  return (
    <div aria-busy="true" aria-label="Loading matches">
      <div className="mb-5 rounded-card bg-gradient-to-br from-sidebar to-sidebar-top p-5 sm:p-7">
        <SkeletonBlock className="h-3 w-32 bg-white/10" />
        <SkeletonBlock className="mt-3 h-7 w-64 max-w-full bg-white/10" />
        <SkeletonBlock className="mt-2 h-7 w-48 max-w-full bg-white/10" />
        <SkeletonBlock className="mt-4 h-9 w-40 bg-white/10" />
      </div>
      <div className="mb-5 flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonBlock key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      <CardListSkeleton count={5} />
    </div>
  );
}
