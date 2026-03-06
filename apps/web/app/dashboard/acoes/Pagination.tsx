"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Pagination as DSPagination } from "rharuow-ds";

type Props = {
  currentPage: number;
  totalPages: number;
};

export function Pagination({ currentPage, totalPages }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goTo(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`${pathname}?${params.toString()}`);
  }

  if (totalPages <= 1) return null;

  return (
    <div className="mt-6">
      <DSPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={goTo}
      />
    </div>
  );
}
