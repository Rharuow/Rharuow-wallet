import { IncomeAnalysisShell } from "./IncomeAnalysisShell";

export const metadata = { title: "Análise de Entradas — RharouWallet" };

export default function IncomeAnalysisPage() {
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
      <IncomeAnalysisShell />
    </div>
  );
}
