"use client";

import Link from "next/link";
import { Card } from "rharuow-ds";
import { formatBRL, formatCompact } from "@/lib/format";
import { Metric } from "@/components/Metric";

export type StockItem = {
  stock: string;
  name: string;
  close: number;
  change: number;
  volume: number;
  market_cap: number | null;
  sector: string | null;
  type: string;
  logo: string;
};

export function StockCardSkeleton() {
  return (
    <Card variant="elevated" padding="none" rounded="lg">
      <Card.Body className="p-4 flex flex-col gap-3 animate-pulse">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-slate-200 shrink-0" />
            <div className="flex flex-col gap-1">
              <div className="h-4 w-16 rounded bg-slate-200" />
              <div className="h-3 w-24 rounded bg-slate-200" />
            </div>
          </div>
          <div className="h-5 w-20 rounded bg-slate-200" />
        </div>
        {/* Badge */}
        <div className="h-4 w-1/3 rounded-full bg-slate-200" />
        {/* Métricas */}
        <div className="grid grid-cols-3 gap-x-4 gap-y-2 mt-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="h-2 w-12 rounded bg-slate-200" />
              <div className="h-3 w-10 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </Card.Body>
    </Card>
  );
}

export function StockCard({ stock }: { stock: StockItem }) {
  const changeHighlight =
    stock.change > 0 ? "positive" : stock.change < 0 ? "negative" : "neutral";

  const changeLabel = `${stock.change >= 0 ? "+" : ""}${stock.change.toFixed(2)}%`;

  return (
    <Link href={`/dashboard/acoes/${stock.stock}`} className="block group">
      <Card
        variant="elevated"
        padding="none"
        rounded="lg"
        className="hover:shadow-md transition-shadow h-full"
      >
      <Card.Body className="p-4 flex flex-col gap-3">
        {/* Header: logo + ticker + cotação */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {stock.logo ? (
              <img
                src={stock.logo}
                alt={stock.stock}
                className="h-8 w-8 rounded-full object-contain shrink-0 bg-white"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)] text-[10px] font-bold text-[var(--primary)]">
                {stock.stock.slice(0, 2)}
              </div>
            )}
            <div className="min-w-0">
              <span className="text-base font-bold text-[var(--foreground)] block truncate">
                {stock.stock}
              </span>
              <span className="text-[11px] text-slate-400 block truncate">
                {stock.name}
              </span>
            </div>
          </div>
          <span className="text-lg font-bold text-[var(--foreground)] shrink-0">
            {formatBRL(stock.close)}
          </span>
        </div>

        {/* Setor */}
        {stock.sector && (
          <span className="inline-flex w-fit items-center rounded-full bg-[var(--primary-light)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--primary)]">
            {stock.sector}
          </span>
        )}

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-xs mt-1">
          <Metric
            label="Variação"
            value={changeLabel}
            highlight={changeHighlight}
            hint="Variação percentual da cotação em relação ao fechamento anterior"
            position="right"
          />
          <Metric
            label="Market Cap"
            value={stock.market_cap != null ? formatCompact(stock.market_cap) : "—"}
            hint="Valor de mercado: preço × total de ações em circulação"
            position="top"
          />
          <Metric
            label="Volume"
            value={formatCompact(stock.volume)}
            hint="Volume financeiro negociado no dia"
            position="left"
          />
        </div>
      </Card.Body>
    </Card>
    </Link>
  );
}
