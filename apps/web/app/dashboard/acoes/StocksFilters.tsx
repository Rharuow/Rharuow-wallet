"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { Chip, Input, Select } from "rharuow-ds";
import { useStocksLoading } from "./StocksContext";

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

export type StockSortField =
  | "name"
  | "close"
  | "change"
  | "change_abs"
  | "volume"
  | "market_cap_basic";

export type SortOrder = "asc" | "desc";

const SORT_BUTTONS: {
  field: StockSortField;
  label: string;
  defaultOrder: SortOrder;
}[] = [
  { field: "name",             label: "A–Z",        defaultOrder: "asc"  },
  { field: "close",            label: "Cotação",     defaultOrder: "desc" },
  { field: "change",           label: "Variação",    defaultOrder: "desc" },
  { field: "volume",           label: "Volume",      defaultOrder: "desc" },
  { field: "market_cap_basic", label: "Market Cap",  defaultOrder: "desc" },
];

type Props = {
  availableSectors?: string[];
};

export function StocksFilters({ availableSectors = [] }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isPending, startTransition } = useStocksLoading();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentSearch    = searchParams.get("search")    ?? "";
  const currentSortBy    = (searchParams.get("sortBy")    as StockSortField) ?? "market_cap_basic";
  const currentSortOrder = (searchParams.get("sortOrder") as SortOrder) ?? "desc";
  const currentSector    = searchParams.get("sector") ?? "";

  function buildParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
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

  function handleSort(field: StockSortField) {
    const btn = SORT_BUTTONS.find((b) => b.field === field);
    let order: SortOrder;
    if (field === currentSortBy) {
      order = currentSortOrder === "asc" ? "desc" : "asc";
    } else {
      order = btn?.defaultOrder ?? "desc";
    }
    startTransition(() => {
      router.push(
        `${pathname}?${buildParams({ sortBy: field, sortOrder: order })}`
      );
    });
  }

  function handleSector(sector: string) {
    startTransition(() => {
      router.push(
        `${pathname}?${buildParams({ sector: sector || null })}`
      );
    });
  }

  return (
    <div
      className={`flex flex-col gap-4 mb-6 transition-opacity ${
        isPending ? "opacity-60 pointer-events-none" : ""
      }`}
    >
      {/* Row 1: busca + sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <Input
            name="search"
            type="text"
            label="Ticker ou empresa"
            placeholder="Ex: PETR4 ou Petrobras..."
            defaultValue={currentSearch}
            onChange={(e) => handleSearch(e.target.value)}
            Icon={SearchIcon}
          />
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-slate-400 mr-1 whitespace-nowrap">
            Ordenar por:
          </span>
          {SORT_BUTTONS.map(({ field, label }) => {
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

      {/* Row 2: filtro por setor */}
      {availableSectors.length > 0 && (
        <div className="w-full sm:max-w-xs">
          <Select
            name="sector"
            label="Setor"
            isClearable
            value={currentSector}
            onChange={(e) => handleSector(e.target.value)}
            options={availableSectors.map((s) => ({ label: s, value: s }))}
          />
        </div>
      )}
    </div>
  );
}
