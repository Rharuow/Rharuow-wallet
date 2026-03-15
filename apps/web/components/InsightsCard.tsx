"use client";

import { useState } from "react";
import { Card } from "rharuow-ds";

interface InsightsCardProps {
  type: "costs" | "incomes";
  period: { dateFrom: string; dateTo: string };
  analytics: Record<string, unknown>;
  costTotal?: number;
}

export function InsightsCard({ type, period, analytics, costTotal }: InsightsCardProps) {
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setInsights(null);
    try {
      const res = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, period, analytics, costTotal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar insights.");
      setInsights(data.insights);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  const bullets = insights
    ? insights
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("•"))
        .map((l) => l.slice(1).trim())
    : [];

  return (
    <Card className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">✨</span>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Insights com IA
            </p>
            <p className="text-xs text-slate-500">
              Análise personalizada dos seus dados financeiros
            </p>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="shrink-0 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white transition-opacity disabled:opacity-60"
        >
          {loading ? "Gerando…" : insights ? "Atualizar" : "Gerar insights"}
        </button>
      </div>

      {loading && (
        <div className="flex flex-col gap-2 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 rounded bg-slate-200" style={{ width: `${70 + i * 5}%` }} />
          ))}
        </div>
      )}

      {error && !loading && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {!loading && bullets.length > 0 && (
        <ul className="flex flex-col gap-2">
          {bullets.map((bullet, i) => (
            <li key={i} className="flex gap-2 text-sm text-[var(--foreground)]">
              <span className="mt-0.5 shrink-0 text-[var(--primary)]">•</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}

      {!loading && !insights && !error && (
        <p className="text-xs text-slate-400">
          Clique em &quot;Gerar insights&quot; para receber uma análise personalizada com base nos dados do período selecionado.
        </p>
      )}
    </Card>
  );
}
