import { apiFetch } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { IncomesTable } from "./IncomesTable";
import type { Income, IncomeRecurrence } from "./types";
import { getWalletContext } from "@/lib/wallet";

export const metadata = { title: "Entradas — RharouWallet" };
const PAGE_LIMIT = 20;

async function fetchIncomes(
  token: string | null,
  walletOwnerId: string | null | undefined,
  page: number
): Promise<{ incomes: Income[]; total: number }> {
  if (!token) return { incomes: [], total: 0 };
  const data = await apiFetch<{ incomes: Income[]; total: number }>(
    `/v1/incomes?page=${page}&limit=${PAGE_LIMIT}`,
    {
      token,
      walletOwnerId,
      cache: "no-store",
    }
  );
  return { incomes: data.incomes ?? [], total: data.total ?? 0 };
}

async function fetchRecurrences(
  token: string | null,
  walletOwnerId?: string | null
): Promise<IncomeRecurrence[]> {
  if (!token) return [];
  const data = await apiFetch<{ recurrences: IncomeRecurrence[] }>(
    "/v1/incomes/recurrences",
    {
      token,
      walletOwnerId,
      cache: "no-store",
    }
  );
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
  const walletContext = await getWalletContext();
  const walletOwnerId = walletContext?.isShared
    ? walletContext.activeWallet.ownerId
    : null;

  const [{ incomes, total }, recurrences] = await Promise.all([
    fetchIncomes(token, walletOwnerId, page),
    fetchRecurrences(token, walletOwnerId),
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
        canWrite={walletContext?.canWrite ?? true}
      />
    </div>
  );
}
