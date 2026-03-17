import { getAuthToken, getPlan } from "@/lib/auth";
import { PremiumGate } from "@/components/PremiumGate";
import { HealthScoreShell } from "./HealthScoreShell";

export const metadata = { title: "Saúde Financeira — RharouWallet" };

export default async function SaudeFinanceiraPage() {
  const token = await getAuthToken();
  const plan = token
    ? await getPlan(token)
    : ("FREE" as "FREE" | "PREMIUM");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          Saúde Financeira
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Relatório completo combinando custos, entradas e taxa de poupança —
          score de 0 a 10 com recomendações da IA.
        </p>
      </div>

      {plan !== "PREMIUM" ? (
        <PremiumGate feature="O relatório de Saúde Financeira com IA" />
      ) : (
        <HealthScoreShell />
      )}
    </div>
  );
}
