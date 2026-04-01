import { apiFetch } from "@/lib/api";
import { getAuthToken, getPlan } from "@/lib/auth";
import { CostsTable, Cost, CostType, CostRecurrence } from "./CostsTable";
import { CostArea } from "./areas/AreasTable";
import { getWalletContext } from "@/lib/wallet";

export const metadata = { title: "Custos — RharouWallet" };
const PAGE_LIMIT = 20;

async function fetchAreas(
  token: string | null,
  walletOwnerId?: string | null
): Promise<CostArea[]> {
  if (!token) return [];
  const data = await apiFetch<{ areas: CostArea[] }>("/v1/costs/areas", {
    token,
    walletOwnerId,
    cache: "no-store",
  });
  return data.areas ?? [];
}

async function fetchTypes(
  token: string | null,
  walletOwnerId?: string | null
): Promise<CostType[]> {
  if (!token) return [];
  const data = await apiFetch<{ types: CostType[] }>("/v1/costs/types", {
    token,
    walletOwnerId,
    cache: "no-store",
  });
  return data.types ?? [];
}

async function fetchCosts(
  token: string | null,
  walletOwnerId: string | null | undefined,
  page: number
): Promise<{ costs: Cost[]; total: number }> {
  if (!token) return { costs: [], total: 0 };
  const data = await apiFetch<{ costs: Cost[]; total: number }>(
    `/v1/costs?page=${page}&limit=${PAGE_LIMIT}`,
    {
      token,
      walletOwnerId,
      cache: "no-store",
    }
  );
  return { costs: data.costs ?? [], total: data.total ?? 0 };
}

async function fetchRecurrences(
  token: string | null,
  walletOwnerId?: string | null
): Promise<CostRecurrence[]> {
  if (!token) return [];
  const data = await apiFetch<{ recurrences: CostRecurrence[] }>(
    "/v1/costs/recurrences",
    {
      token,
      walletOwnerId,
      cache: "no-store",
    }
  );
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
  const walletContext = await getWalletContext();
  const walletOwnerId = walletContext?.isShared
    ? walletContext.activeWallet.ownerId
    : null;
  const [{ costs, total }, types, areas, recurrences, plan] = await Promise.all([
    fetchCosts(token, walletOwnerId, page),
    fetchTypes(token, walletOwnerId),
    fetchAreas(token, walletOwnerId),
    fetchRecurrences(token, walletOwnerId),
    token ? getPlan(token) : Promise.resolve<"FREE" | "PREMIUM">("FREE"),
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
        isPremium={plan === "PREMIUM" && !walletContext?.isShared}
        canWrite={walletContext?.canWrite ?? true}
      />
    </div>
  );
}
