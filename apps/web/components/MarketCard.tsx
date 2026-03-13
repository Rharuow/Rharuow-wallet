"use client";

import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";
import type { MarketAsset } from "@/lib/market";
import { formatBRL, formatCompact } from "@/lib/format";

function formatValue(asset: MarketAsset): string {
  if (asset.code === "IBOV") {
    const v = asset.value;
    const int = Math.round(v)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${int} pts`;
  }
  if (asset.code === "BTC") {
    return `R$ ${formatCompact(asset.value)}`;
  }
  return formatBRL(asset.value);
}

type Props = {
  asset: MarketAsset;
  selected?: boolean;
  onClick?: () => void;
};

export function MarketCard({ asset, selected = false, onClick }: Props) {
  const positive = asset.change >= 0;
  const color = positive ? "#1ED760" : "#ef4444";
  const bgColor = positive ? "rgba(30,215,96,0.1)" : "rgba(239,68,68,0.1)";

  const minVal = Math.min(...asset.history.map((h) => h.value));
  const maxVal = Math.max(...asset.history.map((h) => h.value));
  const padding = (maxVal - minVal) * 0.1 || 1;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition-all cursor-pointer ${
        selected
          ? "border-[var(--primary)] bg-[var(--primary)]/5 shadow-md"
          : "border-slate-200 bg-[var(--background)] hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold leading-none">{asset.symbol}</span>
          <div>
            <p className="text-xs font-semibold text-[var(--foreground)]">
              {asset.name}
            </p>
            <p className="text-[10px] text-slate-400">{asset.code}</p>
          </div>
        </div>
        <span
          className="text-xs font-semibold px-1.5 py-0.5 rounded-md"
          style={{ color, backgroundColor: bgColor }}
        >
          {positive ? "+" : ""}
          {asset.change.toFixed(2)}%
        </span>
      </div>

      {/* Value */}
      <p className="mt-3 text-base font-bold text-[var(--foreground)] truncate">
        {formatValue(asset)}
      </p>

      {/* Sparkline */}
      {asset.history.length > 1 && (
        <div className="mt-3 h-14 -mx-1">
          <ResponsiveContainer width="100%" height={56}>
            <AreaChart
              data={asset.history}
              margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient
                  id={`grad-${asset.code}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis
                domain={[minVal - padding, maxVal + padding]}
                hide
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const val = payload[0].value as number;
                  return (
                    <div className="rounded-md border border-slate-200 bg-[var(--background)] px-2 py-1 text-[10px] shadow-md">
                      <span className="font-medium text-[var(--foreground)]">
                        {asset.code === "IBOV"
                          ? `${Math.round(val).toLocaleString("pt-BR")} pts`
                          : asset.code === "BTC"
                          ? `R$ ${formatCompact(val)}`
                          : formatBRL(val)}
                      </span>
                      <span className="ml-1 text-slate-400">
                        {payload[0].payload?.date}
                      </span>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#grad-${asset.code})`}
                dot={false}
                activeDot={{ r: 3, fill: color }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </button>
  );
}
