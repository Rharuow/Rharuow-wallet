import { Suspense } from "react";
import { getAuthToken } from "@/lib/auth";
import { FiiCard, FiiItem } from "./FiiCard";
import { Pagination } from "./Pagination";

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

async function fetchFiis(page: number): Promise<StocksResponse> {
  const token = await getAuthToken();
  const url = `${API_URL}/v1/stocks?type=fund&limit=${LIMIT}&page=${page}&sortBy=volume&sortOrder=desc`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Falha ao buscar FIIs: ${res.status}`);
  }

  return res.json();
}

type PageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function FiisPage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  let data: StocksResponse | null = null;
  let error: string | null = null;

  try {
    data = await fetchFiis(page);
  } catch (err) {
    error = err instanceof Error ? err.message : "Erro desconhecido";
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)] mb-6">FIIs</h1>

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
