"use client";

import { AiAnalysisCard } from "@/components/AiAnalysisCard";
import { OnDemandReportCard } from "@/components/OnDemandReportCard";

interface Props {
  ticker: string;
}

export function StockAnalysisCard({ ticker }: Props) {
  return (
    <div className="space-y-4">
      <AiAnalysisCard
        path="/api/ai/stock-analysis"
        payload={{ ticker }}
        feature="A análise com IA do ativo"
      />

      <OnDemandReportCard
        initialAssetType="STOCK"
        initialTicker={ticker}
        title="Relatório on-demand do ativo"
        subtitle="Gera uma leitura fundamentada a partir de um documento-base automático, com cobrança apenas em sucesso."
      />
    </div>
  );
}
