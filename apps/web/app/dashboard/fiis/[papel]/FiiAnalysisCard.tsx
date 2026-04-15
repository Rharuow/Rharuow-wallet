"use client";

import { AiAnalysisCard } from "@/components/AiAnalysisCard";
import { OnDemandReportCard } from "@/components/OnDemandReportCard";

interface Props {
  papel: string;
}

export function FiiAnalysisCard({ papel }: Props) {
  return (
    <div className="space-y-4">
      <AiAnalysisCard
        path="/api/ai/fii-analysis"
        payload={{ papel }}
        feature="A análise com IA do FII"
      />

      <OnDemandReportCard
        initialAssetType="FII"
        initialTicker={papel}
        title="Relatório do FII"
        subtitle="Localiza a melhor base disponível para o fundo e libera a leitura quando houver sucesso."
      />
    </div>
  );
}
