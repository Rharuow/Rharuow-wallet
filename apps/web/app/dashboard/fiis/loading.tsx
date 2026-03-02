import { Suspense } from "react";
import { FiisFilters } from "./FiisFilters";
import { FiiCardSkeleton } from "./FiiCard";

const SKELETON_COUNT = 10;

export default function FiisLoading() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)] mb-4">FIIs</h1>

      <Suspense fallback={null}>
        <FiisFilters />
      </Suspense>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <FiiCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
