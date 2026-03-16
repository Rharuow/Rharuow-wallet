"use client";

import { useState } from "react";
import { PremiumGate } from "@/components/PremiumGate";

interface Props {
  papel: string;
}

export function FiiAnalysisCard({ papel }: Props) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPremiumError, setIsPremiumError] = useState(false);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    setIsPremiumError(false);
    setAnalysis(null);
    try {
      const res = await fetch("/api/ai/fii-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ papel }),
      });
      const data = await res.json();
      if (res.status === 403) {
        setIsPremiumError(true);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar análise.");
      setAnalysis(data.analysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  if (isPremiumError) {
    return <PremiumGate feature="Análise de FII com IA" />;
  }

  const bullets = analysis
    ? analysis
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("•"))
        .map((l) => l.slice(1).trim())
    : [];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background-secondary)] p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">✨</span>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Análise com IA
            </p>
            <p className="text-xs text-slate-500">
              Opinião fundamentalista contextualizada (Premium)
            </p>
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="shrink-0 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white transition-opacity disabled:opacity-60"
        >
          {loading ? "Analisando…" : analysis ? "Reanalisar" : "Analisar com IA"}
        </button>
      </div>

      {loading && (
        <div className="mt-4 flex flex-col gap-2 animate-pulse">
          {[90, 80, 95, 75, 85].map((w, i) => (
            <div
              key={i}
              className="h-4 rounded bg-slate-200"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      )}

      {error && !loading && (
        <p className="mt-4 text-xs text-red-500">{error}</p>
      )}

      {!loading && bullets.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {bullets.map((bullet, i) => (
            <li key={i} className="flex gap-2 text-sm text-[var(--foreground)]">
              <span className="mt-0.5 shrink-0 text-[var(--primary)]">•</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}

      {!loading && !analysis && !error && (
        <p className="mt-4 text-xs text-slate-400">
          Clique em &quot;Analisar com IA&quot; para obter uma análise
          fundamentalista contextualizada com base nos dados de mercado exibidos
          nesta página.
        </p>
      )}
    </div>
  );
}
