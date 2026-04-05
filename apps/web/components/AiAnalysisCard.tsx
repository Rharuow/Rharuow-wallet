"use client";

import { useMemo, useState } from "react";
import { Button } from "rharuow-ds";
import { PremiumGate } from "@/components/PremiumGate";

type Props = {
  path: "/api/ai/stock-analysis" | "/api/ai/fii-analysis";
  payload: Record<string, string>;
  feature: string;
};

export function AiAnalysisCard({ path, payload, feature }: Props) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPremiumError, setIsPremiumError] = useState(false);

  const bullets = useMemo(() => {
    if (!analysis) return [];

    return analysis
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("•") || line.startsWith("-"))
      .map((line) => line.slice(1).trim());
  }, [analysis]);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    setIsPremiumError(false);
    setAnalysis(null);

    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => ({}))) as {
        analysis?: string;
        error?: string;
      };

      if (res.status === 403) {
        setIsPremiumError(true);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error ?? "Erro ao gerar análise.");
      }

      setAnalysis(data.analysis ?? null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
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

          <Button size="xs" onClick={handleAnalyze} disabled={loading}>
            {loading ? "Analisando…" : analysis ? "Reanalisar" : "Analisar com IA"}
          </Button>
        </div>

        {loading ? (
          <div className="mt-4 flex flex-col gap-2 animate-pulse">
            {[90, 80, 95, 75, 85].map((width, index) => (
              <div
                key={index}
                className="h-4 rounded bg-slate-200"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
        ) : null}

        {error && !loading ? (
          <p className="mt-4 text-xs text-red-500">{error}</p>
        ) : null}

        {!loading && bullets.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-3">
            {bullets.map((bullet, index) => (
              <li key={index} className="flex gap-2 text-sm text-[var(--foreground)]">
                <span className="mt-0.5 shrink-0 text-[var(--primary)]">•</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {!loading && !analysis && !error ? (
          <p className="mt-4 text-xs text-slate-400">
            Clique em "Analisar com IA" para obter uma análise fundamentalista contextualizada com base nos dados de mercado exibidos nesta página.
          </p>
        ) : null}
      </div>

      {isPremiumError ? <PremiumGate feature={feature} /> : null}
    </>
  );
}