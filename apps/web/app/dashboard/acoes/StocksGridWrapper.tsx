"use client";

import { StockCardSkeleton } from "./StockCard";
import { useStocksLoading } from "./StocksContext";

const SKELETON_COUNT = 12;

export function StocksGridWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isPending } = useStocksLoading();

  if (isPending) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <StockCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return <>{children}</>;
}
