"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card } from "rharuow-ds";
import { formatBRL } from "@/lib/format";

const COLORS = [
  "#5B3DF5",
  "#1ED760",
  "#F59E0B",
  "#EF4444",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#6366F1",
];

interface ByMonth {
  month: string;
  total: number;
}

interface ByArea {
  areaId: string;
  areaName: string;
  total: number;
}

interface Props {
  byMonth: ByMonth[];
  byArea: ByArea[];
}

function formatMonth(ym: string) {
  const [year, month] = ym.split("-");
  const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${names[parseInt(month, 10) - 1]}/${year.slice(2)}`;
}

function BRLTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-[var(--background)] p-3 text-xs shadow-md">
      <p className="font-semibold text-[var(--foreground)]">{label}</p>
      <p className="text-[var(--primary)]">{formatBRL(payload[0].value)}</p>
    </div>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-[var(--background)] p-3 text-xs shadow-md">
      <p className="font-semibold text-[var(--foreground)]">{payload[0].name}</p>
      <p className="text-[var(--primary)]">{formatBRL(payload[0].value)}</p>
    </div>
  );
}

export function AnalyticsCharts({ byMonth, byArea }: Props) {
  const chartData = byMonth.map((d) => ({
    ...d,
    label: formatMonth(d.month),
  }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Evoluçao mensal */}
      <Card className="p-4">
        <p className="mb-4 text-sm font-semibold text-[var(--foreground)]">
          Evolução mensal
        </p>
        {byMonth.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Sem dados</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11 }}
                width={52}
              />
              <Tooltip content={<BRLTooltip />} />
              <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Por área */}
      <Card className="p-4">
        <p className="mb-4 text-sm font-semibold text-[var(--foreground)]">
          Distribuição por área
        </p>
        {byArea.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Sem dados</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={byArea}
                dataKey="total"
                nameKey="areaName"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) =>
                  `${name} ${(((percent ?? 0) * 100).toFixed(0))}%`
                }
                labelLine={false}
              >
                {byArea.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              <Legend
                formatter={(value) => (
                  <span className="text-xs text-[var(--foreground)]">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
