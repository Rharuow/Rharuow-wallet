"use client";

import { FiiCardSkeleton } from "./FiiCard";
import { useFiisLoading } from "./FiisContext";

const SKELETON_COUNT = 10;

export function FiisGridWrapper({ children }: { children: React.ReactNode }) {
  const { isPending } = useFiisLoading();

  if (isPending) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <FiiCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return <>{children}</>;
}
