"use client";

import { OnDemandReportCard } from "@/components/OnDemandReportCard";

interface Props {
  papel: string;
}

export function FiiAnalysisCard({ papel }: Props) {
  return (
    <OnDemandReportCard
      initialAssetType="FII"
      initialTicker={papel}
      title="Relatório on-demand do FII"
      subtitle="Localiza a melhor base disponível para o fundo e libera a leitura por 30 dias quando houver sucesso."
    />
  );
}
