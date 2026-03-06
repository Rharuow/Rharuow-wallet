"use client";

import { Tooltip } from "rharuow-ds";

export type MetricProps = {
  label: string;
  value: string;
  hint: string;
  highlight?: "positive" | "negative" | "neutral";
  position?: "top" | "bottom" | "left" | "right";
};

export function Metric({ label, value, hint, highlight = "neutral", position = "top" }: MetricProps) {
  const colorClass =
    highlight === "positive"
      ? "text-emerald-600"
      : highlight === "negative"
      ? "text-red-500"
      : "text-[var(--foreground)]";

  return (
    <div className="flex flex-col min-w-0">
      <Tooltip content={hint} position={position} maxWidth={200}>
        <span className="text-slate-400 uppercase tracking-wide text-[10px] whitespace-nowrap cursor-help w-fit">
          {label}
        </span>
      </Tooltip>
      <span className={`font-semibold text-xs ${colorClass} truncate`}>{value}</span>
    </div>
  );
}
