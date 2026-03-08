import { getAuthToken } from "@/lib/auth";
import { CostsTable, Cost, CostType, CostRecurrence } from "./CostsTable";
import { CostArea } from "./areas/AreasTable";

export const metadata = { title: "Custos — RharouWallet" };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const PAGE_LIMIT = 20;

async function fetchAreas(token: string | null): Promise<CostArea[]> {
  if (!token) return [];
  const res = await fetch(`${API_URL}/v1/costs/areas`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.areas ?? [];
}

async function fetchTypes(token: string | null): Promise<CostType[]> {
  if (!token) return [];
  const res = await fetch(`${API_URL}/v1/costs/types`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.types ?? [];
}

async function fetchCosts(
  token: string | null,
  page: number
): Promise<{ costs: Cost[]; total: number }> {
  if (!token) return { costs: [], total: 0 };
  const res = await fetch(
    `${API_URL}/v1/costs?page=${page}&limit=${PAGE_LIMIT}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );
  if (!res.ok) return { costs: [], total: 0 };
  const data = await res.json();
  return { costs: data.costs ?? [], total: data.total ?? 0 };
}

async function fetchRecurrences(token: string | null): Promise<CostRecurrence[]> {
  if (!token) return [];
  const res = await fetch(`${API_URL}/v1/costs/recurrences`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.recurrences ?? [];
}

export default async function CustoPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const token = await getAuthToken();
  const [{ costs, total }, types, areas, recurrences] = await Promise.all([
    fetchCosts(token, page),
    fetchTypes(token),
    fetchAreas(token),
    fetchRecurrences(token),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Custos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Registre e gerencie seus custos domésticos.
        </p>
      </div>
      <CostsTable
        costs={costs}
        types={types}
        areas={areas}
        recurrences={recurrences}
        currentPage={page}
        totalPages={totalPages}
      />
    </div>
  );
}
