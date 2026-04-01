import { apiFetch } from "@/lib/api";
import { getAuthToken, getPlan } from "@/lib/auth";
import { AnalysisShell } from "./AnalysisShell";
import { PremiumGate } from "@/components/PremiumGate";
import { getWalletContext } from "@/lib/wallet";

export const metadata = { title: "Análise de Custos — RharouWallet" };

async function fetchAreas(token: string | null, walletOwnerId?: string | null) {
  if (!token) return [];
  const data = await apiFetch<{ areas: { id: string; name: string }[] }>(
    "/v1/costs/areas",
    {
      token,
      walletOwnerId,
      cache: "no-store",
    }
  );
  return (data.areas ?? []) as { id: string; name: string }[];
}

async function fetchTypes(token: string | null, walletOwnerId?: string | null) {
  if (!token) return [];
  const data = await apiFetch<{ types: { id: string; name: string; areaId: string }[] }>(
    "/v1/costs/types",
    {
      token,
      walletOwnerId,
      cache: "no-store",
    }
  );
  return (data.types ?? []) as { id: string; name: string; areaId: string }[];
}

export default async function AnalisePage() {
  const token = await getAuthToken();
  const walletContext = await getWalletContext();
  const walletOwnerId = walletContext?.isShared
    ? walletContext.activeWallet.ownerId
    : null;
  const [plan, areas, types] = await Promise.all([
    token ? getPlan(token) : Promise.resolve<"FREE" | "PREMIUM">("FREE"),
    fetchAreas(token, walletOwnerId),
    fetchTypes(token, walletOwnerId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          Análise de Custos
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Visualize seus custos domésticos por período, área e tipo.
        </p>
      </div>
      {plan !== "PREMIUM" ? (
        <PremiumGate feature="A análise de custos domésticos" />
      ) : (
        <AnalysisShell
          areas={areas}
          types={types}
          allowInsights={!walletContext?.isShared}
        />
      )}
    </div>
  );
}
