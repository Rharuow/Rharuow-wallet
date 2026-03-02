"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { Chip, Input } from "rharuow-ds";
import { useFiisLoading } from "./FiisContext";

function SearchIcon() {
  return (
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
  );
}

export type SortField = "name" | "close" | "priceToBook";
export type SortOrder = "asc" | "desc";

export function FiisFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isPending, startTransition } = useFiisLoading();
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
      <div className="w-full sm:max-w-xs">
        <Input
          name="search"
          type="text"
          label="Nome ou símbolo do FII"
          placeholder="Buscar por ticker ou nome..."
          defaultValue={currentSearch}
          onChange={(e) => handleSearch(e.target.value)}
          Icon={SearchIcon}
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
            <Chip
              key={field}
              label={`${label}${arrow}`}
              active={active}
              onChange={() => handleSort(field)}
            />
          );
        })}
      </div>
    </div>
  );
}
