import { getAuthToken } from "@/lib/auth";
import { IncomesTable } from "./IncomesTable";
import type { Income, IncomeRecurrence } from "./types";

export const metadata = { title: "Entradas — RharouWallet" };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const PAGE_LIMIT = 20;

async function fetchIncomes(
  token: string | null,
  page: number
): Promise<{ incomes: Income[]; total: number }> {
  if (!token) return { incomes: [], total: 0 };
  const res = await fetch(
    `${API_URL}/v1/incomes?page=${page}&limit=${PAGE_LIMIT}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );
  if (!res.ok) return { incomes: [], total: 0 };
  const data = await res.json();
  return { incomes: data.incomes ?? [], total: data.total ?? 0 };
}

async function fetchRecurrences(
  token: string | null
): Promise<IncomeRecurrence[]> {
  if (!token) return [];
  const res = await fetch(`${API_URL}/v1/incomes/recurrences`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.recurrences ?? [];
}

export default async function EntradasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const token = await getAuthToken();

  const [{ incomes, total }, recurrences] = await Promise.all([
    fetchIncomes(token, page),
    fetchRecurrences(token),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          Entradas
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Registre suas receitas avulsas ou recorrentes (salário, pensão,
          freelance…).
        </p>
      </div>
      <IncomesTable
        incomes={incomes}
        recurrences={recurrences}
        currentPage={page}
        totalPages={totalPages}
      />
    </div>
  );
}
