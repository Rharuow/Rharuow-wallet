"use client";

import { useState, useCallback } from "react";
import { Button, Card, Input, Select } from "rharuow-ds";
import { PremiumGate } from "@/components/PremiumGate";

// ───────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────
interface Summary  { total: number; count: number; average: number }
interface ByMonth  { month: string; total: number }
interface ByArea   { areaId: string; areaName: string; total: number }
interface ByType   { type: string; label: string; total: number; count: number }

interface CostAnalytics  { summary: Summary; byMonth: ByMonth[]; byArea: ByArea[] }
interface IncomeAnalytics { summary: Summary; byMonth: ByMonth[]; byType: ByType[] }

// ───────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────
const PRESETS = [
  { label: "Este mês",        value: "this_month" },
  { label: "Mês anterior",    value: "last_month" },
  { label: "Últimos 3 meses", value: "last_3"     },
  { label: "Últimos 6 meses", value: "last_6"     },
  { label: "Este ano",        value: "this_year"  },
  { label: "Personalizado",   value: "custom"     },
];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function presetToDates(p: string): { dateFrom: string; dateTo: string } | null {
  const now = new Date();
  const ms = (y: number, m: number) => new Date(y, m, 1);
  const me = (y: number, m: number) => new Date(y, m + 1, 0);
  switch (p) {
    case "this_month":
      return { dateFrom: isoDate(ms(now.getFullYear(), now.getMonth())), dateTo: isoDate(me(now.getFullYear(), now.getMonth())) };
    case "last_month": {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { dateFrom: isoDate(ms(d.getFullYear(), d.getMonth())), dateTo: isoDate(me(d.getFullYear(), d.getMonth())) };
    }
    case "last_3": {
      const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return { dateFrom: isoDate(ms(d.getFullYear(), d.getMonth())), dateTo: isoDate(me(now.getFullYear(), now.getMonth())) };
    }
    case "last_6": {
      const d = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      return { dateFrom: isoDate(ms(d.getFullYear(), d.getMonth())), dateTo: isoDate(me(now.getFullYear(), now.getMonth())) };
    }
    case "this_year":
      return { dateFrom: isoDate(new Date(now.getFullYear(), 0, 1)), dateTo: isoDate(new Date(now.getFullYear(), 11, 31)) };
    default:
      return null;
  }
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function gradeFromScore(score: number): { letter: string; color: string; bg: string } {
  if (score >= 9) return { letter: "A+", color: "text-emerald-600", bg: "bg-emerald-50" };
  if (score >= 7) return { letter: "A",  color: "text-emerald-600", bg: "bg-emerald-50" };
  if (score >= 6) return { letter: "B",  color: "text-blue-600",    bg: "bg-blue-50"    };
  if (score >= 5) return { letter: "C",  color: "text-yellow-600",  bg: "bg-yellow-50"  };
  if (score >= 3) return { letter: "D",  color: "text-orange-600",  bg: "bg-orange-50"  };
  return                  { letter: "F",  color: "text-red-600",     bg: "bg-red-50"     };
}

// ───────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────
export function HealthScoreShell() {
  const [preset, setPreset]   = useState("this_month");
  const [from,   setFrom]     = useState("");
  const [to,     setTo]       = useState("");

  // analytics data
  const [costs,   setCosts]   = useState<CostAnalytics   | null>(null);
  const [incomes, setIncomes] = useState<IncomeAnalytics | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError,   setDataError]   = useState<string | null>(null);

  // AI score
  const [aiResult,     setAiResult]     = useState<string | null>(null);
  const [loadingScore, setLoadingScore] = useState(false);
  const [scoreError,   setScoreError]   = useState<string | null>(null);
  const [isPremiumErr, setIsPremiumErr] = useState(false);

  // resolved period
  const [period, setPeriod] = useState<{ dateFrom: string; dateTo: string } | null>(null);

  const resolvedDates = useCallback((): { dateFrom: string; dateTo: string } | null => {
    if (preset !== "custom") return presetToDates(preset);
    if (from && to) return { dateFrom: from, dateTo: to };
    return null;
  }, [preset, from, to]);

  async function handleFetchData() {
    const dates = resolvedDates();
    if (!dates) return;

    setLoadingData(true);
    setDataError(null);
    setCosts(null);
    setIncomes(null);
    setAiResult(null);
    setIsPremiumErr(false);
    setPeriod(dates);

    try {
      const dateFrom = new Date(`${dates.dateFrom}T00:00:00`).toISOString();
      const dateTo   = new Date(`${dates.dateTo}T23:59:59`).toISOString();
      const params   = new URLSearchParams({ dateFrom, dateTo });

      const [costsRes, incomesRes] = await Promise.all([
        fetch(`/api/costs/analytics?${params}`),
        fetch(`/api/incomes/analytics?${params}`),
      ]);

      if (!costsRes.ok)   throw new Error("Erro ao carregar dados de custos.");
      if (!incomesRes.ok) throw new Error("Erro ao carregar dados de entradas.");

      const [costsData, incomesData] = await Promise.all([
        costsRes.json(),
        incomesRes.json(),
      ]);

      setCosts(costsData);
      setIncomes(incomesData);
    } catch (e) {
      setDataError(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setLoadingData(false);
    }
  }

  async function handleGenerateScore() {
    if (!costs || !incomes || !period) return;

    setLoadingScore(true);
    setScoreError(null);
    setIsPremiumErr(false);
    setAiResult(null);

    try {
      const res = await fetch("/api/ai/financial-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, costs, incomes }),
      });
      const data = await res.json();
      if (res.status === 403) { setIsPremiumErr(true); return; }
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar score.");
      setAiResult(data.result);
    } catch (e) {
      setScoreError(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setLoadingScore(false);
    }
  }

  // ── Parse AI result ──────────────────────────────────────
  const scoreLine  = aiResult?.split("\n").find((l) => l.startsWith("SCORE:")) ?? null;
  const scoreValue = scoreLine ? parseInt(scoreLine.replace("SCORE:", "").trim(), 10) : null;
  const bullets    = aiResult
    ? aiResult.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("•")).map((l) => l.slice(1).trim())
    : [];
  const grade = scoreValue != null ? gradeFromScore(scoreValue) : null;

  // ── Derived metrics ──────────────────────────────────────
  const totalIncome  = incomes?.summary.total   ?? 0;
  const totalCosts   = costs?.summary.total     ?? 0;
  const savingAmount = totalIncome - totalCosts;
  const savingRate   = totalIncome > 0 ? (savingAmount / totalIncome) * 100 : null;
  const periodMonths = period ? (() => {
    const from = new Date(period.dateFrom);
    const to   = new Date(period.dateTo);
    return Math.max(1, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1);
  })() : 1;
  const avgMonthlyCost = totalCosts / periodMonths;
  const runwayMonths = avgMonthlyCost > 0 ? savingAmount / avgMonthlyCost : null;

  return (
    <div className="flex flex-col gap-6">

      {/* ── Period filter ───────────────────────────────── */}
      <Card className="flex flex-col gap-4 p-5">
        <p className="text-sm font-semibold text-[var(--foreground)]">Selecione o período</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-48">
            <Select
              name="preset"
              label="Período"
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              options={PRESETS}
            />
          </div>
          {preset === "custom" && (
            <>
              <div className="w-40">
                <Input name="dateFrom" label="De" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="w-40">
                <Input name="dateTo" label="Até" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </>
          )}
          <Button onClick={handleFetchData} disabled={loadingData || !resolvedDates()}>
            {loadingData ? "Carregando…" : "Analisar período"}
          </Button>
        </div>
        {dataError && <p className="text-xs text-red-500">{dataError}</p>}
      </Card>

      {/* ── Metrics cards ───────────────────────────────── */}
      {costs && incomes && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetricCard label="Renda Total"       value={formatBRL(totalIncome)}   hint="Soma de todas as entradas no período" />
          <MetricCard label="Gastos Totais"     value={formatBRL(totalCosts)}    hint="Soma de todos os custos no período" />
          <MetricCard
            label="Taxa de Poupança"
            value={savingRate != null ? `${savingRate.toFixed(1)}%` : "—"}
            hint="(Renda − Gastos) / Renda × 100"
            highlight={savingRate == null ? "neutral" : savingRate >= 20 ? "positive" : savingRate >= 0 ? "neutral" : "negative"}
          />
          <MetricCard
            label="Burn Rate"
            value={runwayMonths != null ? `${runwayMonths.toFixed(1)} meses` : "—"}
            hint="Quantos meses de custo foram poupados no período"
            highlight={runwayMonths == null ? "neutral" : runwayMonths >= 6 ? "positive" : runwayMonths >= 3 ? "neutral" : "negative"}
          />
        </div>
      )}

      {/* ── AI Score section ────────────────────────────── */}
      {costs && incomes && !isPremiumErr && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background-secondary)] p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">💚</span>
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">Score de Saúde Financeira</p>
                <p className="text-xs text-slate-500">Relatório IA: poupança, burn rate e recomendações (Premium)</p>
              </div>
            </div>
            <Button size="xs" onClick={handleGenerateScore} disabled={loadingScore}>
              {loadingScore ? "Gerando…" : aiResult ? "Reatualizar" : "Gerar Score"}
            </Button>
          </div>

          {loadingScore && (
            <div className="mt-4 flex flex-col gap-2 animate-pulse">
              {[85, 70, 90, 75, 80, 65].map((w, i) => (
                <div key={i} className="h-4 rounded bg-slate-200" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}

          {scoreError && !loadingScore && (
            <p className="mt-4 text-xs text-red-500">{scoreError}</p>
          )}

          {!loadingScore && grade != null && scoreValue != null && (
            <div className="mt-5 flex flex-col gap-5">
              {/* Score gauge */}
              <div className={`flex items-center gap-5 rounded-xl p-4 ${grade.bg}`}>
                <div className={`flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-4 ${grade.color.replace("text-", "border-")}`}>
                  <span className={`text-3xl font-black leading-none ${grade.color}`}>{grade.letter}</span>
                  <span className={`text-xs font-semibold ${grade.color}`}>{scoreValue}/10</span>
                </div>
                <div>
                  <p className={`text-lg font-bold ${grade.color}`}>
                    {scoreValue >= 7 ? "Saúde financeira boa" : scoreValue >= 5 ? "Saúde financeira regular" : "Saúde financeira crítica"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Score baseado em taxa de poupança, burn rate, diversificação de renda e composição de gastos.
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>0</span>
                  <span>5</span>
                  <span>10</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full transition-all ${
                      scoreValue >= 7 ? "bg-emerald-500" : scoreValue >= 5 ? "bg-yellow-400" : "bg-red-500"
                    }`}
                    style={{ width: `${(scoreValue / 10) * 100}%` }}
                  />
                </div>
              </div>

              {/* Insights bullets */}
              {bullets.length > 0 && (
                <ul className="flex flex-col gap-3">
                  {bullets.map((bullet, i) => (
                    <li key={i} className="flex gap-2 text-sm text-[var(--foreground)]">
                      <span className="mt-0.5 shrink-0 text-[var(--primary)]">•</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!loadingScore && !aiResult && !scoreError && (
            <p className="mt-4 text-xs text-slate-400">
              Clique em &quot;Gerar Score&quot; para receber um relatório completo de saúde financeira com nota, burn rate e recomendação prioritária.
            </p>
          )}
        </div>
      )}

      {isPremiumErr && <PremiumGate feature="Score de Saúde Financeira com IA" />}
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// MetricCard helper
// ───────────────────────────────────────────────────────────
function MetricCard({
  label,
  value,
  hint,
  highlight = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  highlight?: "positive" | "negative" | "neutral";
}) {
  const color =
    highlight === "positive" ? "text-emerald-600" :
    highlight === "negative" ? "text-red-500"     :
    "text-[var(--foreground)]";

  return (
    <Card className="flex flex-col gap-1 p-4">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-400">{hint}</p>
    </Card>
  );
}
