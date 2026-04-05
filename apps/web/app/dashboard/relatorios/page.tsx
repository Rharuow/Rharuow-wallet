import { OnDemandReportCard } from "@/components/OnDemandReportCard";

export const metadata = {
  title: "Relatórios On-Demand — RharouWallet",
};

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Relatórios On-Demand</h1>
        <p className="mt-1 text-sm text-slate-500">
          Busque por ticker, acompanhe o job de análise e, se necessário, envie o relatório manualmente. O consumo de créditos só acontece em sucesso final.
        </p>
      </div>

      <OnDemandReportCard editable title="Consultar relatório por ticker" subtitle="A busca automática localiza uma fonte confiável, reaproveita análises compatíveis e libera acesso temporário por 30 dias. Quando isso falhar, o fallback manual assume o fluxo sem bloquear novos jobs." />
    </div>
  );
}