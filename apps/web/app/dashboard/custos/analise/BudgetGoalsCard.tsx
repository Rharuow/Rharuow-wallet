"use client";

import { useState } from "react";
import { Button } from "rharuow-ds";
import { PremiumGate } from "@/components/PremiumGate";

interface ByArea  { areaId: string; areaName: string; total: number }
interface ByMonth { month: string; total: number }
interface Summary { total: number; count: number; average: number }

interface Props {
  period: { dateFrom: string; dateTo: string };
  summary: Summary;
  byArea: ByArea[];
  byMonth: ByMonth[];
}

export function BudgetGoalsCard({ period, summary, byArea, byMonth }: Props) {
  const [suggestions, setSuggestions] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPremiumError, setIsPremiumError] = useState(false);

  async function handleSuggest() {
    setLoading(true);
    setError(null);
    setIsPremiumError(false);
    setSuggestions(null);

    try {
      // Fetch income total for the same period
      const dateFrom = new Date(`${period.dateFrom}T00:00:00`).toISOString();
      const dateTo   = new Date(`${period.dateTo}T23:59:59`).toISOString();

      const incomeRes = await fetch(
        `/api/incomes/analytics?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`
      );
      const incomeTotal = incomeRes.ok
        ? ((await incomeRes.json()) as { summary?: { total?: number } })?.summary?.total ?? 0
        : 0;

      const res = await fetch("/api/ai/budget-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, summary, byArea, byMonth, incomeTotal }),
      });

      const data = await res.json();
      if (res.status === 403) {
        setIsPremiumError(true);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar sugestões.");
      setSuggestions(data.suggestions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  if (isPremiumError) {
    return <PremiumGate feature="Sugestão de metas com IA" />;
  }

  const bullets = suggestions
    ? suggestions
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("•"))
        .map((l) => l.slice(1).trim())
    : [];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background-secondary)] p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎯</span>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Metas de Orçamento com IA
            </p>
            <p className="text-xs text-slate-500">
              Sugestões personalizadas por área de custo (Premium)
            </p>
          </div>
        </div>

        <Button size="xs" onClick={handleSuggest} disabled={loading || byArea.length === 0}>
          {loading ? "Gerando…" : suggestions ? "Rever metas" : "Sugerir metas"}
        </Button>
      </div>

      {byArea.length === 0 && !loading && (
        <p className="mt-4 text-xs text-slate-400">
          Selecione um período com dados por área para gerar sugestões.
        </p>
      )}

      {loading && (
        <div className="mt-4 flex flex-col gap-2 animate-pulse">
          {[85, 70, 90, 75, 80, 65].map((w, i) => (
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
          {bullets.map((bullet, i) => {
            // Last bullet is the savings goal — highlight it
            const isSavings = bullet.toLowerCase().startsWith("meta de poupança");
            return (
              <li
                key={i}
                className={`flex gap-2 text-sm ${
                  isSavings
                    ? "rounded-lg bg-[var(--primary-light)] p-3 font-medium text-[var(--primary)]"
                    : "text-[var(--foreground)]"
                }`}
              >
                <span className={`mt-0.5 shrink-0 ${isSavings ? "text-[var(--primary)]" : "text-[var(--primary)]"}`}>
                  {isSavings ? "🎯" : "•"}
                </span>
                <span>{bullet}</span>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && !suggestions && !error && byArea.length > 0 && (
        <p className="mt-4 text-xs text-slate-400">
          Clique em &quot;Sugerir metas&quot; para receber metas de orçamento
          mensais personalizadas para cada área de custo, baseadas no seu
          histórico de gastos e renda.
        </p>
      )}
    </div>
  );
}
