"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "rharuow-ds";

type Props = {
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
};

export function Pagination({ currentPage, totalPages, hasNextPage }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goTo(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`${pathname}?${params.toString()}`);
  }

  const delta = 2;
  const range: (number | "…")[] = [];
  const left = Math.max(1, currentPage - delta);
  const right = Math.min(totalPages, currentPage + delta);

  if (left > 1) {
    range.push(1);
    if (left > 2) range.push("…");
  }
  for (let i = left; i <= right; i++) range.push(i);
  if (right < totalPages) {
    if (right < totalPages - 1) range.push("…");
    range.push(totalPages);
  }

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1 mt-6 flex-wrap">
      <Button
        variant="outline"
        onClick={() => goTo(currentPage - 1)}
        disabled={currentPage <= 1}
      >
        ‹
      </Button>

      {range.map((item, idx) =>
        item === "…" ? (
          <span key={`ellipsis-${idx}`} className="px-2 text-slate-400 select-none">
            …
          </span>
        ) : (
          <Button
            key={item}
            variant={item === currentPage ? "default" : "outline"}
            onClick={() => goTo(item as number)}
          >
            {item}
          </Button>
        )
      )}

      <Button
        variant="outline"
        onClick={() => goTo(currentPage + 1)}
        disabled={!hasNextPage}
      >
        ›
      </Button>
    </div>
  );
}
