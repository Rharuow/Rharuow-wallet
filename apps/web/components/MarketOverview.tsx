"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Chip } from "rharuow-ds";
import type { MarketAsset } from "@/lib/market";
import { MarketCard } from "./MarketCard";
import { formatBRL, formatCompact } from "@/lib/format";

function formatYAxis(code: string, value: number): string {
  if (code === "IBOV") {
    return formatCompact(value);
  }
  if (code === "BTC") {
    return `R$ ${formatCompact(value)}`;
  }
  return formatBRL(value);
}

function formatTooltipValue(code: string, value: number): string {
  if (code === "IBOV") {
    return `${Math.round(value).toLocaleString("pt-BR")} pts`;
  }
  if (code === "BTC") {
    return `R$ ${formatCompact(value)}`;
  }
  return formatBRL(value);
}

type Props = {
  assets: MarketAsset[];
};

type Period = "7d" | "1m" | "3m" | "6m" | "1y";

const PERIODS: { key: Period; label: string; days: number }[] = [
  { key: "7d", label: "7D", days: 7 },
  { key: "1m", label: "1M", days: 30 },
  { key: "3m", label: "3M", days: 90 },
  { key: "6m", label: "6M", days: 180 },
  { key: "1y", label: "1A", days: 365 },
];

export function MarketOverview({ assets }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [period, setPeriod] = useState<Period>("1m");
  const [mounted, setMounted] = useState(false);
  const selected = assets[selectedIndex] ?? assets[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!selected) return null;

  const positive = selected.change >= 0;
  const color = positive ? "#1ED760" : "#ef4444";

  const activePeriod = PERIODS.find((p) => p.key === period)!;
  const filteredHistory = selected.history.slice(-activePeriod.days);

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
        Mercado
      </h2>

      {/* Cards grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {assets.map((asset, i) => (
          <MarketCard
            key={asset.code}
            asset={asset}
            selected={i === selectedIndex}
            onClick={() => setSelectedIndex(i)}
          />
        ))}
      </div>

      {/* Main chart */}
      {mounted && selected.history.length > 1 && (
        <div className="rounded-xl border border-slate-200 bg-[var(--background)] p-4">
          {/* Chart header */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {selected.name}{" "}
                <span className="font-normal text-slate-400">
                  — {filteredHistory.length} dias
                </span>
              </p>
            </div>
            <div className="flex items-center gap-1">
              {PERIODS.map((p) => (
                <Chip
                  key={p.key}
                  label={p.label}
                  active={period === p.key}
                  onChange={() => setPeriod(p.key)}
                />
              ))}
              <span
                className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-md"
                style={{
                  color,
                  backgroundColor: positive
                    ? "rgba(30,215,96,0.1)"
                    : "rgba(239,68,68,0.1)",
                }}
              >
                {positive ? "+" : ""}
                {selected.change.toFixed(2)}% hoje
              </span>
            </div>
          </div>

          <div className="h-60">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart
                data={filteredHistory}
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient
                    id={`main-grad-${selected.code}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => formatYAxis(selected.code, v)}
                  width={70}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border border-slate-200 bg-[var(--background)] px-3 py-2 shadow-lg text-xs">
                        <p className="text-slate-400 mb-1">{label}</p>
                        <p className="font-semibold text-[var(--foreground)]">
                          {formatTooltipValue(
                            selected.code,
                            payload[0].value as number,
                          )}
                        </p>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#main-grad-${selected.code})`}
                  dot={false}
                  activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}
