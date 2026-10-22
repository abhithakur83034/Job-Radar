import { CardListSkeleton, SkeletonBlock } from "@/components/Skeleton";

// Shown instantly when navigating between dashboard pages (sidebar/tab bar stay in place)
// while the next page's data loads. Also lets Next.js prefetch up to this boundary.
export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonBlock key={i} className="h-[74px]" />
        ))}
      </div>
      <CardListSkeleton count={4} />
    </div>
  );
}
