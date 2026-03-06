import { Suspense } from "react";
import { getAuthToken } from "@/lib/auth";
import { StockCard, StockItem } from "./StockCard";
import { Pagination } from "./Pagination";
import { StocksFilters, StockSortField, SortOrder } from "./StocksFilters";
import { StocksLoadingProvider } from "./StocksContext";
import { StocksGridWrapper } from "./StocksGridWrapper";

export const metadata = {
  title: "Ações — RharouWallet",
};

type StocksListResponse = {
  stocks: StockItem[];
  availableSectors: string[];
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalCount: number;
  hasNextPage: boolean;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const LIMIT = 12;

async function fetchStocks(params: {
  page: number;
  search?: string;
  sector?: string;
  sortBy: StockSortField;
  sortOrder: SortOrder;
}): Promise<StocksListResponse> {
  const token = await getAuthToken();

  const qs = new URLSearchParams({
    limit: String(LIMIT),
    page: String(params.page),
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  });
  if (params.search) qs.set("search", params.search);
  if (params.sector) qs.set("sector", params.sector);

  const res = await fetch(`${API_URL}/v1/stocks?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Falha ao buscar ações: ${res.status}`);

  return res.json();
}

type PageProps = {
  searchParams: Promise<{
    page?: string;
    search?: string;
    sector?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
};

export default async function AcoesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page      = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const search    = sp.search?.trim() || undefined;
  const sector    = sp.sector?.trim() || undefined;
  const sortBy    = (sp.sortBy ?? "market_cap_basic") as StockSortField;
  const sortOrder = (sp.sortOrder === "asc" ? "asc" : "desc") as SortOrder;

  let data: StocksListResponse | null = null;
  let error: string | null = null;

  try {
    data = await fetchStocks({ page, search, sector, sortBy, sortOrder });
  } catch (err) {
    error = err instanceof Error ? err.message : "Erro desconhecido";
  }

  return (
    <StocksLoadingProvider>
      <h1 className="text-2xl font-bold text-[var(--foreground)] mb-4">Ações</h1>

      <Suspense fallback={null}>
        <StocksFilters availableSectors={data?.availableSectors ?? []} />
      </Suspense>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && data.stocks.length === 0 && (
        <p className="text-sm text-slate-500">Nenhuma ação encontrada.</p>
      )}

      {data && data.stocks.length > 0 && (
        <>
          <StocksGridWrapper>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.stocks.map((stock) => (
                <StockCard key={stock.stock} stock={stock} />
              ))}
            </div>
          </StocksGridWrapper>

          <Suspense fallback={null}>
            <Pagination
              currentPage={data.currentPage}
              totalPages={data.totalPages}
            />
          </Suspense>
        </>
      )}
    </StocksLoadingProvider>
  );
}

