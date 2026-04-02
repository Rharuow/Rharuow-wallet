import { getAuthToken, getPlan } from "@/lib/auth";
import { IncomeAnalysisShell } from "./IncomeAnalysisShell";
import { PremiumGate } from "@/components/PremiumGate";
import { getWalletContext } from "@/lib/wallet";

export const metadata = { title: "Análise de Entradas — RharouWallet" };

export default async function IncomeAnalysisPage() {
  const token = await getAuthToken();
  const plan = token ? await getPlan(token) : "FREE";
  const walletContext = await getWalletContext();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          Análise de Entradas
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Visualize sua evolução de receitas por período.
        </p>
      </div>
      {plan !== "PREMIUM" ? (
        <PremiumGate feature="A análise de entradas" />
      ) : (
        <IncomeAnalysisShell allowInsights={!walletContext?.isShared} />
      )}
    </div>
  );
}
