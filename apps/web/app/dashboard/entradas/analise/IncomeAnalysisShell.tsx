"use client";

import { useState, useCallback, useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Button, Card, Input, Tooltip } from "rharuow-ds";
import { formatBRL } from "../types";
import { InsightsCard } from "../../../../components/InsightsCard";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
interface Summary {
  total: number;
  count: number;
  average: number;
}
interface ByMonth {
  month: string;
  total: number;
}
interface ByType {
  type: string;
  label: string;
  total: number;
  count: number;
}
interface Analytics {
  summary: Summary;
  byMonth: ByMonth[];
  byType: ByType[];
}

interface CostSummary {
  summary: { total: number };
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
const COLORS = ["#5B3DF5", "#1ED760"];

function formatMonth(ym: string) {
  const [year, month] = ym.split("-");
  const names = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  return `${names[parseInt(month, 10) - 1]}/${year.slice(2)}`;
}

type ChartTooltipProps = {
  active?: boolean;
  label?: string;
  payload?: Array<{ value: number; name?: string }>;
};

function BRLTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-[var(--background)] p-3 text-xs shadow-md">
      <p className="font-semibold text-[var(--foreground)]">{label}</p>
      <p className="text-[var(--primary)]">{formatBRL(payload[0].value)}</p>
    </div>
  );
}

function PieTooltipContent({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-[var(--background)] p-3 text-xs shadow-md">
      <p className="font-semibold text-[var(--foreground)]">{payload[0].name}</p>
      <p className="text-[var(--primary)]">{formatBRL(payload[0].value)}</p>
    </div>
  );
}

// ----------------------------------------------------------------
// Period filter
// ----------------------------------------------------------------
type Filters = { dateFrom: string; dateTo: string };

function getDefaultDates(): Filters {
  const now = new Date();
  const isFirstDay = now.getDate() === 1;
  if (isFirstDay) {
    // Show previous month
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      dateFrom: prevMonth.toISOString().slice(0, 10),
      dateTo: lastDayPrev.toISOString().slice(0, 10),
    };
  }
  // Show current month from the 1st until today
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return {
    dateFrom: `${year}-${month}-01`,
    dateTo: now.toISOString().slice(0, 10),
  };
}

const DEFAULT_DATES = getDefaultDates();

function PeriodFilter({
  onChange,
}: {
  onChange: (f: Filters) => void;
}) {
  const methods = useForm<Filters>({
    defaultValues: DEFAULT_DATES,
  });
  const { register, setValue } = methods;

  function applyPreset(from: string, to: string) {
    setValue("dateFrom", from);
    setValue("dateTo", to);
    onChange({ dateFrom: from, dateTo: to });
  }

  const now = new Date();

  function thisMonth() {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    applyPreset(`${year}-${month}-01`, now.toISOString().slice(0, 10));
  }

  function thisYear() {
    applyPreset(`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`);
  }

  function last3Months() {
    const from = new Date(now);
    from.setMonth(from.getMonth() - 2);
    applyPreset(
      `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-01`,
      now.toISOString().slice(0, 10)
    );
  }

  return (
    <FormProvider {...methods}>
      <form
        className="flex flex-wrap gap-3 items-end"
        onSubmit={methods.handleSubmit((data) => onChange(data))}
        noValidate
      >
        <Input
          label="De"
          type="date"
          {...register("dateFrom", { required: true })}
        />
        <Input
          label="Até"
          type="date"
          {...register("dateTo", { required: true })}
        />
        <Button type="submit">
          Aplicar
        </Button>
      </form>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={thisMonth}>
          Este mês
        </Button>
        <Button variant="outline" onClick={last3Months}>
          Últimos 3 meses
        </Button>
        <Button variant="outline" onClick={thisYear}>
          Este ano
        </Button>
      </div>
    </FormProvider>
  );
}

// ----------------------------------------------------------------
// Main shell
// ----------------------------------------------------------------
export function IncomeAnalysisShell({ allowInsights = true }: { allowInsights?: boolean }) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [costTotal, setCostTotal] = useState<number | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(DEFAULT_DATES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFilters = useCallback(async (filters: Filters) => {
    setAppliedFilters(filters);
    setLoading(true);
    setError(null);
    try {
      const dateFrom = new Date(`${filters.dateFrom}T00:00:00`).toISOString();
      const dateTo = new Date(`${filters.dateTo}T23:59:59`).toISOString();
      const params = new URLSearchParams({ dateFrom, dateTo });

      const [incomeRes, costRes] = await Promise.all([
        fetch(`/api/incomes/analytics?${params.toString()}`),
        fetch(`/api/costs/analytics?${params.toString()}`),
      ]);

      if (!incomeRes.ok) throw new Error("Erro ao carregar análise de entradas.");
      const incomeData: Analytics = await incomeRes.json();
      setAnalytics(incomeData);

      if (costRes.ok) {
        const costData: CostSummary = await costRes.json();
        setCostTotal(costData.summary?.total ?? 0);
      } else {
        setCostTotal(0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load with default period on mount
  useEffect(() => {
    handleFilters(DEFAULT_DATES);
  }, [handleFilters]);

  const chartData = (analytics?.byMonth ?? []).map((d) => ({
    ...d,
    label: formatMonth(d.month),
  }));

  const pieData = (analytics?.byType ?? [])
    .filter((t) => t.total > 0)
    .map((t) => ({ name: t.label, value: t.total }));

  return (
    <div className="flex flex-col gap-6">
      <PeriodFilter onChange={handleFilters} />

      {loading && (
        <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
      )}

      {error && (
        <p className="py-4 text-center text-sm text-red-500">{error}</p>
      )}

      {!loading && analytics && (
        <>
          {/* Summary cards */}
          {(() => {
            const net =
              costTotal !== null
                ? analytics.summary.total - costTotal
                : null;
            return (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="p-4 flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Total de entradas
                  </span>
                  <span className="text-2xl font-bold text-[var(--foreground)]">
                    {formatBRL(analytics.summary.total)}
                  </span>
                </Card>
                <Card className="p-4 flex flex-col gap-1">
                  <Tooltip
                    content="Entradas menos total de custos no mesmo período"
                    position="top"
                  >
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500 cursor-help underline decoration-dotted">
                      Saldo líquido
                    </span>
                  </Tooltip>
                  <span
                    className={`text-2xl font-bold ${
                      net === null
                        ? "text-[var(--foreground)]"
                        : net >= 0
                        ? "text-green-600"
                        : "text-red-500"
                    }`}
                  >
                    {net !== null ? formatBRL(net) : "—"}
                  </span>
                </Card>
                <Card className="p-4 flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Nº de entradas
                  </span>
                  <span className="text-2xl font-bold text-[var(--foreground)]">
                    {analytics.summary.count}
                  </span>
                </Card>
                <Card className="p-4 flex flex-col gap-1">
                  <Tooltip
                    content="Valor médio por entrada (Total ÷ Nº de entradas)"
                    position="top"
                  >
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500 cursor-help underline decoration-dotted">
                      Ticket médio
                    </span>
                  </Tooltip>
                  <span className="text-2xl font-bold text-[var(--foreground)]">
                    {formatBRL(analytics.summary.average)}
                  </span>
                </Card>
              </div>
            );
          })()}

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Monthly evolution */}
            <Card className="p-4">
              <p className="mb-4 text-sm font-semibold text-[var(--foreground)]">
                Evolução mensal
              </p>
              {chartData.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  Sem dados
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis
                      tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11 }}
                      width={52}
                    />
                    <RechartTooltip content={<BRLTooltip />} />
                    <Bar
                      dataKey="total"
                      fill="var(--primary)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* Recorrente vs Avulso */}
            <Card className="p-4">
              <p className="mb-4 text-sm font-semibold text-[var(--foreground)]">
                Recorrente vs Avulso
              </p>
              {pieData.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  Sem dados
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell
                          key={index}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <RechartTooltip content={<PieTooltipContent />} />
                    <Legend
                      formatter={(value) => (
                        <span className="text-xs">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          {/* Breakdown table */}
          <Card className="p-4">
            <p className="mb-3 text-sm font-semibold text-[var(--foreground)]">
              Detalhamento por tipo
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="pb-2 text-left">Tipo</th>
                  <th className="pb-2 text-right">Lançamentos</th>
                  <th className="pb-2 text-right">Total</th>
                  <th className="pb-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {analytics.byType.map((t) => (
                  <tr key={t.type} className="border-b last:border-0">
                    <td className="py-2">{t.label}</td>
                    <td className="py-2 text-right text-slate-600">
                      {t.count}
                    </td>
                    <td className="py-2 text-right font-medium">
                      {formatBRL(t.total)}
                    </td>
                    <td className="py-2 text-right text-slate-500">
                      {analytics.summary.total > 0
                        ? `${((t.total / analytics.summary.total) * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* AI Insights */}
          {allowInsights && (
            <InsightsCard
              key={`${appliedFilters.dateFrom}-${appliedFilters.dateTo}`}
              type="incomes"
              period={{ dateFrom: appliedFilters.dateFrom, dateTo: appliedFilters.dateTo }}
              analytics={analytics as unknown as Record<string, unknown>}
              costTotal={costTotal ?? undefined}
            />
          )}
        </>
      )}
    </div>
  );
}
