import { OnDemandReportCard } from "@/components/OnDemandReportCard";

export const metadata = {
  title: "Relatórios por Ticker — RharouWallet",
};

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Relatórios por ticker</h1>
        <p className="mt-1 text-sm text-slate-500">
          Busque por ticker, acompanhe o processamento e, se necessário, envie um arquivo manual. O consumo de créditos só acontece em sucesso final.
        </p>
      </div>

      <OnDemandReportCard editable title="Consultar relatório por ticker" />
    </div>
  );
}