"use client";

import Link from "next/link";
import { Card } from "rharuow-ds";
import { formatBRL, formatCompact } from "@/lib/format";
import { Metric } from "@/components/Metric";

export function FiiCardSkeleton() {
  return (
    <Card variant="elevated" padding="none" rounded="lg">
      <Card.Body className="p-4 flex flex-col gap-3 animate-pulse">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-slate-200 shrink-0" />
            <div className="h-4 w-16 rounded bg-slate-200" />
          </div>
          <div className="h-5 w-20 rounded bg-slate-200" />
        </div>

        {/* Nome */}
        <div className="h-3 w-3/4 rounded bg-slate-200" />

        {/* Setor */}
        <div className="h-4 w-1/3 rounded-full bg-slate-200" />

        {/* Métricas */}
        <div className="flex items-center gap-4 mt-1">
          <div className="flex flex-col gap-1">
            <div className="h-2 w-12 rounded bg-slate-200" />
            <div className="h-3 w-10 rounded bg-slate-200" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="h-2 w-8 rounded bg-slate-200" />
            <div className="h-3 w-8 rounded bg-slate-200" />
          </div>
          <div className="flex flex-col gap-1 ml-auto">
            <div className="h-2 w-10 rounded bg-slate-200" />
            <div className="h-3 w-12 rounded bg-slate-200" />
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}

export type FiiItem = {
  papel: string;
  segmento: string;
  cotacao: number | null;
  ffoYield: number | null;
  dividendYield: number | null;
  pvp: number | null;
  valorMercado: number | null;
  liquidez: number | null;
  qtdImoveis: number | null;
  precoM2: number | null;
  aluguelM2: number | null;
  capRate: number | null;
  vacanciaMedia: number | null;
};


export function FiiCard({ fii }: { fii: FiiItem }) {
  const pvpColor =
    fii.pvp == null
      ? "neutral"
      : fii.pvp < 1
      ? "positive"
      : fii.pvp > 1.2
      ? "negative"
      : "neutral";

  return (
    <Link href={`/dashboard/fiis/${fii.papel}`} className="block group">
      <Card variant="elevated" padding="none" rounded="lg" className="hover:shadow-md transition-shadow h-full">
      <Card.Body className="p-4 flex flex-col gap-3">
        {/* Header: avatar + ticker + cotação */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)] text-[10px] font-bold text-[var(--primary)]">
              {fii.papel.slice(0, 2)}
            </div>
            <span className="text-base font-bold text-[var(--foreground)] truncate">
              {fii.papel}
            </span>
          </div>
          <span className="text-lg font-bold text-[var(--foreground)] shrink-0">
            {fii.cotacao != null ? formatBRL(fii.cotacao) : "—"}
          </span>
        </div>

        {/* Segmento */}
        {fii.segmento && (
          <span className="inline-flex w-fit items-center rounded-full bg-[var(--primary-light)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--primary)]">
            {fii.segmento}
          </span>
        )}

        {/* Métricas — linha 1 */}
        <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-xs mt-1">
          <Metric
            label="D.Y."
            value={fii.dividendYield != null ? `${fii.dividendYield.toFixed(2)}%` : "—"}
            hint="Dividend Yield: rendimento distribuído nos últimos 12 meses em relação à cotação atual"
            position="right"
          />
          <Metric
            label="P/VP"
            value={fii.pvp != null ? fii.pvp.toFixed(2) : "—"}
            highlight={pvpColor}
            hint="Preço/Valor Patrimonial: valores abaixo de 1 indicam desconto em relação ao patrimônio do fundo"
            position="top"
          />
          <Metric
            label="FFO Yield"
            value={fii.ffoYield != null ? `${fii.ffoYield.toFixed(2)}%` : "—"}
            hint="FFO Yield: geração de caixa operacional (Funds From Operations) em relação à cotação"
            position="left"
          />
          <Metric
            label="Val. Mercado"
            value={fii.valorMercado != null ? formatCompact(fii.valorMercado) : "—"}
            hint="Valor de Mercado: capitalização total do fundo (preço × cotas emitidas)"
            position="right"
          />
          <Metric
            label="Liquidez"
            value={fii.liquidez != null ? formatCompact(fii.liquidez) : "—"}
            hint="Liquidez Diária: volume médio negociado por dia nos últimos 2 meses"
            position="top"
          />
          <Metric
            label="Vacância"
            value={fii.vacanciaMedia != null ? `${fii.vacanciaMedia.toFixed(1)}%` : "—"}
            hint="Vacância Média: percentual de área disponível não locada no portfólio do fundo"
            position="left"
          />
        </div>
      </Card.Body>
    </Card>
    </Link>
  );
}
