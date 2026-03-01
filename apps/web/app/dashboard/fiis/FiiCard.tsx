"use client";

import Image from "next/image";
import { Card } from "rharuow-ds";
import { formatBRL, formatCompact } from "@/lib/format";

export type FiiItem = {
  stock: string;
  name: string;
  close?: number | null;
  change?: number | null;
  volume?: number | null;
  market_cap?: number | null;
  logo?: string | null;
  sector?: string | null;
  priceToBook?: number | null;
};

export function FiiCard({ fii }: { fii: FiiItem }) {
  const changePositive = (fii.change ?? 0) >= 0;

  return (
    <Card variant="elevated" padding="none" rounded="lg" className="hover:shadow-md transition-shadow">
      <Card.Body className="p-4 flex flex-col gap-3">
        {/* Header: logo + ticker + preço */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {fii.logo ? (
              <Image
                src={fii.logo}
                alt={fii.stock}
                width={32}
                height={32}
                className="rounded-full object-contain shrink-0"
                unoptimized
                style={{
                    width: 32,
                    height: 32
                }}
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)] text-[10px] font-bold text-[var(--primary)]">
                {fii.stock.slice(0, 2)}
              </div>
            )}
            <span className="text-base font-bold text-[var(--foreground)] truncate">
              {fii.stock}
            </span>
          </div>
          <span className="text-lg font-bold text-[var(--foreground)] shrink-0">
            {fii.close != null ? formatBRL(fii.close) : "—"}
          </span>
        </div>

        {/* Nome completo */}
        <p className="text-xs text-slate-500 leading-snug line-clamp-2">
          {fii.name}
        </p>

        {/* Setor */}
        {fii.sector && (
          <span className="inline-flex w-fit items-center rounded-full bg-[var(--primary-light)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--primary)]">
            {fii.sector}
          </span>
        )}

        {/* Métricas */}
        <div className="flex items-center gap-4 text-xs mt-1">
          <div className="flex flex-col">
            <span className="text-slate-400 uppercase tracking-wide text-[10px]">Variação</span>
            <span
              className={`font-semibold ${
                changePositive ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {fii.change != null
                ? `${changePositive ? "+" : ""}${fii.change.toFixed(2)}%`
                : "—"}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-slate-400 uppercase tracking-wide text-[10px]">P/VP</span>
            <span className="font-semibold text-[var(--foreground)]">
              {fii.priceToBook != null ? fii.priceToBook.toFixed(2) : "—"}
            </span>
          </div>

          {fii.volume != null && (
            <div className="flex flex-col ml-auto">
              <span className="text-slate-400 uppercase tracking-wide text-[10px]">Volume</span>
              <span className="font-semibold text-[var(--foreground)]">
                {formatCompact(fii.volume)}
              </span>
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}
