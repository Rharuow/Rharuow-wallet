"use client";

import { Card, Tooltip } from "rharuow-ds";
import { formatBRL } from "@/lib/format";

interface Summary {
  total: number;
  count: number;
  average: number;
}

export function SummaryCards({ summary }: { summary: Summary }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card className="p-4 flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Total no período
        </span>
        <span className="text-2xl font-bold text-[var(--foreground)]">
          {formatBRL(summary.total)}
        </span>
      </Card>
      <Card className="p-4 flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Nº de lançamentos
        </span>
        <span className="text-2xl font-bold text-[var(--foreground)]">
          {summary.count}
        </span>
      </Card>
      <Card className="p-4 flex flex-col gap-1">
        <Tooltip
          content="Valor médio por lançamento (Total ÷ Nº de lançamentos)"
          position="top"
        >
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 cursor-help underline decoration-dotted">
            Ticket médio
          </span>
        </Tooltip>
        <span className="text-2xl font-bold text-[var(--foreground)]">
          {formatBRL(summary.average)}
        </span>
      </Card>
    </div>
  );
}
