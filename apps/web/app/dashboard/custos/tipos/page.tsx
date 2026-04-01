import { apiFetch } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { TypesTable } from "./TypesTable";
import { CostType } from "../types";
import { getWalletContext } from "@/lib/wallet";

export const metadata = { title: "Tipos de Custo — RharouWallet" };

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

async function fetchAreas(
  token: string | null,
  walletOwnerId?: string | null
): Promise<{ id: string; name: string }[]> {
  if (!token) return [];
  const data = await apiFetch<{ areas: { id: string; name: string }[] }>(
    "/v1/costs/areas",
    {
      token,
      walletOwnerId,
      cache: "no-store",
    }
  );
  return data.areas ?? [];
}

export default async function TiposPage() {
  const token = await getAuthToken();
  const walletContext = await getWalletContext();
  const walletOwnerId = walletContext?.isShared
    ? walletContext.activeWallet.ownerId
    : null;
  const [types, areas] = await Promise.all([
    fetchTypes(token, walletOwnerId),
    fetchAreas(token, walletOwnerId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          Tipos de Custo
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Tipos de custo associados às áreas cadastradas.
        </p>
      </div>
      <TypesTable
        types={types}
        areas={areas}
        canWrite={walletContext?.canWrite ?? true}
      />
    </div>
  );
}
