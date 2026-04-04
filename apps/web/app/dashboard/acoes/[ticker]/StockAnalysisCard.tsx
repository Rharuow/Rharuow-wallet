"use client";

import { OnDemandReportCard } from "@/components/OnDemandReportCard";

interface Props {
  ticker: string;
}

export function StockAnalysisCard({ ticker }: Props) {
  return (
    <OnDemandReportCard
      initialAssetType="STOCK"
      initialTicker={ticker}
      title="Relatório on-demand do ativo"
      subtitle="Gera uma leitura fundamentada a partir de um documento-base automático, com cobrança apenas em sucesso."
    />
  );
}
