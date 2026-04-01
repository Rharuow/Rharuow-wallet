import { apiFetch } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { AreasTable, CostArea } from "./AreasTable";
import { getWalletContext } from "@/lib/wallet";

export const metadata = { title: "Áreas de Custo — RharouWallet" };

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

export default async function AreasPage() {
  const token = await getAuthToken();
  const walletContext = await getWalletContext();
  const walletOwnerId = walletContext?.isShared
    ? walletContext.activeWallet.ownerId
    : null;
  const areas = await fetchAreas(token, walletOwnerId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          Áreas de Custo
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Áreas padrão do sistema e suas áreas personalizadas.
        </p>
      </div>
      <AreasTable areas={areas} canWrite={walletContext?.canWrite ?? true} />
    </div>
  );
}
