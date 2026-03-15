"use client";

import { useState, useCallback } from "react";
import { AnalyticsFilter, Filters } from "./PeriodFilter";
import { SummaryCards } from "./SummaryCards";
import { AnalyticsCharts } from "./AnalyticsCharts";
import { BreakdownTable } from "./BreakdownTable";
import { InsightsCard } from "../../../../components/InsightsCard";

interface ByMonth { month: string; total: number }
interface ByArea  { areaId: string; areaName: string; total: number }
interface ByType  { typeId: string; typeName: string; areaName: string; areaId: string; total: number; count: number }
interface Summary { total: number; count: number; average: number }
interface Area    { id: string; name: string }
interface CostType { id: string; name: string; areaId: string }

interface Analytics {
  summary: Summary;
  byMonth: ByMonth[];
  byArea: ByArea[];
  byType: ByType[];
}

interface Props {
  areas: Area[];
  types: CostType[];
}

export function AnalysisShell({ areas, types }: Props) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFilters = useCallback(async (filters: Filters) => {
    setFilters(filters);
    setLoading(true);
    setError(null);
    try {
      const dateFrom = new Date(`${filters.dateFrom}T00:00:00`).toISOString();
      const dateTo = new Date(`${filters.dateTo}T23:59:59`).toISOString();
      const params = new URLSearchParams({ dateFrom, dateTo });
      if (filters.areaId) params.set("areaId", filters.areaId);
      if (filters.costTypeId) params.set("costTypeId", filters.costTypeId);
      const res = await fetch(`/api/costs/analytics?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao carregar análise.");
      setAnalytics(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <AnalyticsFilter areas={areas} types={types} onChange={handleFilters} />

      {loading && (
        <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
      )}

      {error && (
        <p className="py-4 text-center text-sm text-red-500">{error}</p>
      )}

      {!loading && analytics && (
        <>
          <SummaryCards summary={analytics.summary} />
          <AnalyticsCharts byMonth={analytics.byMonth} byArea={analytics.byArea} />
          <BreakdownTable
            byType={analytics.byType}
            byArea={analytics.byArea}
            grandTotal={analytics.summary.total}
          />
          {filters && (
            <InsightsCard
              key={`${filters.dateFrom}-${filters.dateTo}`}
              type="costs"
              period={{ dateFrom: filters.dateFrom, dateTo: filters.dateTo }}
              analytics={analytics as unknown as Record<string, unknown>}
            />
          )}
        </>
      )}
    </div>
  );
}
