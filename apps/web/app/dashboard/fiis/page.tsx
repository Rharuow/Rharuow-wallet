import { Suspense } from "react";
import { getAuthToken } from "@/lib/auth";
import { FiiCard, FiiItem } from "./FiiCard";
import { Pagination } from "./Pagination";
import { FiisFilters, SortField, SortOrder } from "./FiisFilters";

export const metadata = {
  title: "FIIs — RharouWallet",
};

type StocksResponse = {
  stocks: FiiItem[];
  currentPage?: number;
  totalPages?: number;
  itemsPerPage?: number;
  totalCount?: number;
  hasNextPage?: boolean;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const LIMIT = 10;

async function fetchFiis(params: {
  page: number;
  search?: string;
  sortBy: string;
  sortOrder: SortOrder;
}): Promise<StocksResponse> {
  const token = await getAuthToken();

  const qs = new URLSearchParams({
    type: "fund",
    limit: String(LIMIT),
    page: String(params.page),
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  });
  if (params.search) qs.set("search", params.search);

  const res = await fetch(`${API_URL}/v1/stocks?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Falha ao buscar FIIs: ${res.status}`);
  }

  return res.json();
}

function sortByPvp(stocks: FiiItem[], order: SortOrder): FiiItem[] {
  return [...stocks].sort((a, b) => {
    const av = a.priceToBook ?? (order === "asc" ? Infinity : -Infinity);
    const bv = b.priceToBook ?? (order === "asc" ? Infinity : -Infinity);
    return order === "asc" ? av - bv : bv - av;
  });
}

type PageProps = {
  searchParams: Promise<{
    page?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
};

export default async function FiisPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const search = sp.search?.trim() || undefined;
  const sortField = (sp.sortBy ?? "volume") as SortField | "volume";
  const sortOrder: SortOrder = sp.sortOrder === "asc" ? "asc" : "desc";

  // P/VP is enriched post-fetch on the backend, not a valid brapi sortBy field.
  // We fetch with default sort (volume desc) and re-sort client-result here.
  const apiSortBy = sortField === "priceToBook" ? "volume" : sortField;

  let data: StocksResponse | null = null;
  let error: string | null = null;

  try {
    data = await fetchFiis({ page, search, sortBy: apiSortBy, sortOrder });
    if (sortField === "priceToBook" && data) {
      data = { ...data, stocks: sortByPvp(data.stocks, sortOrder) };
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Erro desconhecido";
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)] mb-4">FIIs</h1>

      <Suspense fallback={null}>
        <FiisFilters />
      </Suspense>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && data.stocks.length === 0 && (
        <p className="text-sm text-slate-500">Nenhum FII encontrado.</p>
      )}

      {data && data.stocks.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.stocks.map((fii) => (
              <FiiCard key={fii.stock} fii={fii} />
            ))}
          </div>

          <Suspense fallback={null}>
            <Pagination
              currentPage={data.currentPage ?? page}
              totalPages={data.totalPages ?? 1}
              hasNextPage={data.hasNextPage ?? false}
            />
          </Suspense>
        </>
      )}
    </div>
  );
}

