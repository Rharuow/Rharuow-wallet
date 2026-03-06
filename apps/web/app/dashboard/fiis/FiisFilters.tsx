"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { Chip, Input, Select } from "rharuow-ds";
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

export type SortField =
  | "papel"
  | "segmento"
  | "cotacao"
  | "ffoYield"
  | "dividendYield"
  | "pvp"
  | "valorMercado"
  | "liquidez"
  | "qtdImoveis"
  | "precoM2"
  | "aluguelM2"
  | "capRate"
  | "vacanciaMedia";

export type SortOrder = "asc" | "desc";

const SORT_BUTTONS: { field: SortField; label: string; defaultOrder: SortOrder }[] = [
  { field: "papel",         label: "A–Z",          defaultOrder: "asc"  },
  { field: "cotacao",       label: "Cotação",       defaultOrder: "desc" },
  { field: "dividendYield", label: "D.Y.",          defaultOrder: "desc" },
  { field: "pvp",           label: "P/VP",          defaultOrder: "asc"  },
  { field: "ffoYield",      label: "FFO Yield",     defaultOrder: "desc" },
  { field: "valorMercado",  label: "Val. Mercado",  defaultOrder: "desc" },
  { field: "liquidez",      label: "Liquidez",      defaultOrder: "desc" },
  { field: "capRate",       label: "Cap Rate",      defaultOrder: "desc" },
  { field: "vacanciaMedia", label: "Vacância",      defaultOrder: "asc"  },
];

type Props = {
  segmentos?: string[];
};

export function FiisFilters({ segmentos = [] }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isPending, startTransition } = useFiisLoading();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentSearch   = searchParams.get("search")   ?? "";
  const currentSortBy   = (searchParams.get("sortBy")   as SortField) ?? "papel";
  const currentSortOrder = (searchParams.get("sortOrder") as SortOrder) ?? "asc";
  const currentSegmento = searchParams.get("segmento") ?? "";

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
        router.push(`${pathname}?${buildParams({ search: value.trim() || null })}`);
      });
    }, 400);
  }

  function handleSort(field: SortField) {
    const btn = SORT_BUTTONS.find((b) => b.field === field);
    let order: SortOrder;
    if (field === currentSortBy) {
      order = currentSortOrder === "asc" ? "desc" : "asc";
    } else {
      order = btn?.defaultOrder ?? "asc";
    }
    startTransition(() => {
      router.push(`${pathname}?${buildParams({ sortBy: field, sortOrder: order })}`);
    });
  }

  function handleSegmento(seg: string) {
    startTransition(() => {
      router.push(
        `${pathname}?${buildParams({ segmento: seg || null })}`
      );
    });
  }

  return (
    <div className={`flex flex-col gap-4 mb-6 transition-opacity ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
      {/* Row 1: search + sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <Input
            name="search"
            type="text"
            label="Ticker ou segmento"
            placeholder="Ex: MXRF11 ou Logística..."
            defaultValue={currentSearch}
            onChange={(e) => handleSearch(e.target.value)}
            Icon={SearchIcon}
          />
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-slate-400 mr-1 whitespace-nowrap">Ordenar por:</span>
          {SORT_BUTTONS.map(({ field, label }) => {
            const active = currentSortBy === field;
            const arrow = active ? (currentSortOrder === "asc" ? " ↑" : " ↓") : "";
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

      {/* Row 2: segmento filter (only when list is available) */}
      {segmentos.length > 0 && (
        <div className="w-full sm:max-w-xs">
          <Select
            name="segmento"
            label="Segmento"
            isClearable
            value={currentSegmento}
            onChange={(e) => handleSegmento(e.target.value)}
            options={segmentos.map((seg) => ({ label: seg, value: seg }))}
          />
        </div>
      )}
    </div>
  );
}

