import { SkeletonBlock } from "@/components/Skeleton";

export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <SkeletonBlock className="mb-5 h-7 w-48" />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonBlock key={i} className="h-[86px]" />
        ))}
      </div>
      <SkeletonBlock className="h-64" />
    </div>
  );
}
