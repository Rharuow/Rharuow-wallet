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
        scopeToInitialAsset
        title="Relatório do ativo"
        subtitle="Gera uma leitura fundamentada a partir da melhor fonte disponível para o ticker, com cobrança apenas em sucesso."
      />
    </div>
  );
}
