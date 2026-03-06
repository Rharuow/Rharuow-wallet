import { Suspense } from "react";
import { getAuthToken } from "@/lib/auth";
import { FiiCard, FiiItem } from "./FiiCard";
import { Pagination } from "./Pagination";
import { FiisFilters, SortField, SortOrder } from "./FiisFilters";
import { FiisLoadingProvider } from "./FiisContext";
import { FiisGridWrapper } from "./FiisGridWrapper";

export const metadata = {
  title: "FIIs — RharouWallet",
};

type FiiListResponse = {
  fiis: FiiItem[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  segmentos: string[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const LIMIT = 12;

async function fetchFiis(params: {
  page: number;
  search?: string;
  segmento?: string;
  sortBy: SortField;
  sortOrder: SortOrder;
}): Promise<FiiListResponse> {
  const token = await getAuthToken();

  const qs = new URLSearchParams({
    limit: String(LIMIT),
    page: String(params.page),
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  });
  if (params.search)   qs.set("search",   params.search);
  if (params.segmento) qs.set("segmento", params.segmento);

  const res = await fetch(`${API_URL}/v1/fiis?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Falha ao buscar FIIs: ${res.status}`);

  return res.json();
}

type PageProps = {
  searchParams: Promise<{
    page?: string;
    search?: string;
    segmento?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
};

export default async function FiisPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page       = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const search     = sp.search?.trim()   || undefined;
  const segmento   = sp.segmento?.trim() || undefined;
  const sortField  = (sp.sortBy ?? "papel") as SortField;
  const sortOrder: SortOrder = sp.sortOrder === "desc" ? "desc" : "asc";

  let data: FiiListResponse | null = null;
  let error: string | null = null;

  try {
    data = await fetchFiis({ page, search, segmento, sortBy: sortField, sortOrder });
  } catch (err) {
    error = err instanceof Error ? err.message : "Erro desconhecido";
  }

  return (
    <FiisLoadingProvider>
      <h1 className="text-2xl font-bold text-[var(--foreground)] mb-4">FIIs</h1>

      <Suspense fallback={null}>
        <FiisFilters segmentos={data?.segmentos ?? []} />
      </Suspense>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && data.fiis.length === 0 && (
        <p className="text-sm text-slate-500">Nenhum FII encontrado.</p>
      )}

      {data && data.fiis.length > 0 && (
        <>
          <FiisGridWrapper>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.fiis.map((fii) => (
                <FiiCard key={fii.papel} fii={fii} />
              ))}
            </div>
          </FiisGridWrapper>

          <Suspense fallback={null}>
            <Pagination
              currentPage={data.currentPage}
              totalPages={data.totalPages}
            />
          </Suspense>
        </>
      )}
    </FiisLoadingProvider>
  );
}

