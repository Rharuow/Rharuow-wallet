"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useTransition } from "react";

export type SortField = "name" | "close" | "priceToBook";
export type SortOrder = "asc" | "desc";

export function FiisFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentSearch = searchParams.get("search") ?? "";
  const currentSortBy = (searchParams.get("sortBy") as SortField) ?? "volume";
  const currentSortOrder = (searchParams.get("sortOrder") as SortOrder) ?? "desc";

  function buildParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    // Reset page whenever filters/sort change
    params.set("page", "1");
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    return params.toString();
  }

  function handleSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(() => {
        router.push(
          `${pathname}?${buildParams({ search: value.trim() || null })}`
        );
      });
    }, 400);
  }

  function handleSort(field: SortField) {
    // If clicking the active field, toggle direction; otherwise default to asc
    let order: SortOrder;
    if (field === currentSortBy) {
      order = currentSortOrder === "asc" ? "desc" : "asc";
    } else {
      // For close and priceToBook, default desc makes more sense
      order = field === "name" ? "asc" : "desc";
    }
    startTransition(() => {
      router.push(`${pathname}?${buildParams({ sortBy: field, sortOrder: order })}`);
    });
  }

  const sortButtons: { field: SortField; label: string }[] = [
    { field: "name", label: "Alfabético" },
    { field: "close", label: "Cotação" },
    { field: "priceToBook", label: "P/VP" },
  ];

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 transition-opacity ${isPending ? "opacity-60" : ""}`}>
      {/* Search input */}
      <div className="relative w-full sm:max-w-xs">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
          </svg>
        </span>
        <input
          type="text"
          placeholder="Buscar por ticker ou nome..."
          defaultValue={currentSearch}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-[var(--foreground)] placeholder-slate-400 outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors"
        />
      </div>

      {/* Sort buttons */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs text-slate-400 mr-1 whitespace-nowrap">Ordenar por:</span>
        {sortButtons.map(({ field, label }) => {
          const active = currentSortBy === field;
          const arrow = active
            ? currentSortOrder === "asc"
              ? " ↑"
              : " ↓"
            : "";
          return (
            <button
              key={field}
              onClick={() => handleSort(field)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                active
                  ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-[var(--primary)] hover:text-[var(--primary)]"
              }`}
            >
              {label}
              {arrow}
            </button>
          );
        })}
      </div>
    </div>
  );
}
