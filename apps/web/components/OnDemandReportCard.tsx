"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Input, Select, useToast } from "rharuow-ds";

type AssetType = "STOCK" | "FII";

type RequestMode = "AUTO_WEB" | "MANUAL_UPLOAD";

type ValuationMethod = "GRAHAM" | "BAZIN";

type ValuationInsight = {
  method: ValuationMethod;
  title: string;
  badge: string;
  formula: string;
  description: string;
  fairLabel: string;
  fairPrice: number | null;
  currentPrice: number | null;
  potentialPercent: number | null;
  potentialLabel: string;
};

type ReportJobStatus =
  | "QUEUED"
  | "SEARCHING_REPORT"
  | "VALIDATING_REPORT"
  | "ANALYZING_REPORT"
  | "COMPLETED"
  | "SEARCH_UNAVAILABLE"
  | "FAILED";

type ReportAnalysisPayload = {
  access: { id: string; expiresAt: string };
  analysis: {
    id: string;
    assetType: AssetType;
    ticker: string;
    analysisText: string;
    model: string;
    validUntil: string;
    source: {
      id: string;
      sourceKind: "AUTO_FOUND" | "MANUAL_UPLOAD";
      sourceUrl: string | null;
      originalFileName: string | null;
      title: string | null;
      publisher: string | null;
      sourceType: string | null;
      discoveryMethod: string | null;
    };
  };
};

type ReportJob = {
  id: string;
  userId: string;
  assetType: AssetType;
  ticker: string;
  requestMode: RequestMode;
  status: ReportJobStatus;
  attemptCount: number;
  failureCode: string | null;
  failureMessage: string | null;
  priceCharged: string | null;
  analysisId: string | null;
  sourceId: string | null;
  lockedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

const terminalStatuses = new Set<ReportJobStatus>([
  "COMPLETED",
  "FAILED",
  "SEARCH_UNAVAILABLE",
]);

const assetTypeOptions = [
  { label: "Ação", value: "STOCK" },
  { label: "FII", value: "FII" },
];
const MANUAL_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

function formatCurrency(value: string) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return parsed.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function parseCurrencyBRL(raw: string | null | undefined): number | null {
  if (!raw) {
    return null;
  }

  const normalized = raw
    .replace(/R\$/gi, "")
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function potentialLabel(method: ValuationMethod, potentialPercent: number | null) {
  if (potentialPercent == null) {
    return "Sem base";
  }

  if (potentialPercent >= 25) {
    return method === "GRAHAM" ? "Forte Desconto" : "Muito Abaixo";
  }

  if (potentialPercent >= 5) {
    return "Abaixo do justo";
  }

  if (potentialPercent > -5) {
    return "Próximo do justo";
  }

  if (potentialPercent > -25) {
    return "Acima do justo";
  }

  return method === "BAZIN" ? "Muito Caro" : "Bem Esticado";
}

function parseValuationBullets(bullets: string[]) {
  const insights: ValuationInsight[] = [];
  const remaining: string[] = [];

  for (const bullet of bullets) {
    const lower = bullet.toLowerCase();
    const isGraham = lower.startsWith("fórmula de graham") || lower.startsWith("formula de graham");
    const isBazin = lower.startsWith("fórmula de bazin") || lower.startsWith("formula de bazin");

    if (!isGraham && !isBazin) {
      remaining.push(bullet);
      continue;
    }

    const method: ValuationMethod = isGraham ? "GRAHAM" : "BAZIN";
    const fairMatch = bullet.match(/(?:=|é)\s*(R\$\s*[\d.,]+)/i);
    const currentMatch = bullet.match(/preço atual:\s*(R\$\s*[\d.,]+)/i);
    const fairPrice = parseCurrencyBRL(fairMatch?.[1]);
    const currentPrice = parseCurrencyBRL(currentMatch?.[1]);
    const potentialPercent =
      fairPrice != null && currentPrice != null && currentPrice > 0
        ? ((fairPrice - currentPrice) / currentPrice) * 100
        : null;

    insights.push({
      method,
      title: method === "GRAHAM" ? "Fórmula de Graham" : "Método Bazin",
      badge: method === "GRAHAM" ? "Preço Justo" : "Preço Teto",
      formula:
        method === "GRAHAM"
          ? "√(22,5 × LPA × VPA)"
          : "(DPA × 100) ÷ 6%",
      description:
        method === "GRAHAM"
          ? "Criada por Benjamin Graham, considera lucratividade e solidez patrimonial"
          : "Método de Décio Bazin focado em renda passiva com yield mínimo de 6%",
      fairLabel: method === "GRAHAM" ? "Preço Justo (Graham)" : "Preço Teto (Bazin)",
      fairPrice,
      currentPrice,
      potentialPercent,
      potentialLabel: potentialLabel(method, potentialPercent),
    });
  }

  return { insights, remaining };
}

function errorMessageForCode(error?: string) {
  const normalizedError = (error ?? "").trim().toUpperCase();

  if (error === "INSUFFICIENT_CREDITS") {
    return "Você não tem créditos suficientes para continuar essa análise.";
  }

  if (error === "REPORT_AUTO_SEARCH_COOLDOWN_ACTIVE") {
    return "Esse ticker está temporariamente indisponível para nova busca automática. Você ainda pode enviar um arquivo manual.";
  }

  if (error === "REPORT_SOURCE_NOT_FOUND") {
    return "Não encontramos um relatório automaticamente para esse ticker. Se quiser, você pode enviar um arquivo logo abaixo.";
  }

  if (error === "REPORT_SOURCE_MANUAL_ASSET_MISMATCH") {
    return "O arquivo enviado não parece pertencer ao ticker informado. Revise o documento e tente novamente.";
  }

  if (error === "REPORT_SOURCE_MANUAL_UNSUPPORTED_FILE") {
    return "Esse tipo de arquivo não é aceito. Envie um PDF, TXT, MD, CSV, JSON ou HTML.";
  }

  if (error === "REPORT_SOURCE_MANUAL_FILE_TOO_LARGE") {
    return "O arquivo é muito grande. Envie um documento de até 10 MB.";
  }

  if (error === "REPORT_SOURCE_MANUAL_CONTENT_TOO_SHORT") {
    return "Não conseguimos identificar conteúdo suficiente nesse arquivo para gerar a análise.";
  }

  if (error === "REPORT_ANALYSIS_AI_NOT_CONFIGURED") {
    return "A análise está temporariamente indisponível neste ambiente.";
  }

  if (
    normalizedError === "PAYLOAD TOO LARGE" ||
    normalizedError === "PAYLOAD_TOO_LARGE" ||
    normalizedError === "REQUEST ENTITY TOO LARGE" ||
    normalizedError === "ENTITY TOO LARGE" ||
    normalizedError === "413"
  ) {
    return "O arquivo enviado ultrapassa o limite de tamanho. Envie um documento menor e tente novamente.";
  }

  if (normalizedError.includes("PAYLOAD") && normalizedError.includes("LARGE")) {
    return "O arquivo enviado ultrapassa o limite de tamanho. Envie um documento menor e tente novamente.";
  }

  return "Não foi possível concluir a análise agora. Tente novamente em instantes.";
}

function isTerminalJob(status: ReportJobStatus) {
  return terminalStatuses.has(status);
}

function formatJobStatus(status: ReportJobStatus) {
  if (status === "QUEUED") return "Na fila";
  if (status === "SEARCHING_REPORT") return "Buscando relatório";
  if (status === "VALIDATING_REPORT") return "Validando documento";
  if (status === "ANALYZING_REPORT") return "Gerando análise";
  if (status === "COMPLETED") return "Concluído";
  if (status === "SEARCH_UNAVAILABLE") return "Busca indisponível";
  return "Falhou";
}

function statusToneClass(status: ReportJobStatus) {
  if (status === "COMPLETED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "FAILED" || status === "SEARCH_UNAVAILABLE") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function formatRequestMode(mode: RequestMode) {
  return mode === "MANUAL_UPLOAD" ? "Upload manual" : "Busca automática";
}

function normalizeTicker(value: string) {
  return value.trim().toUpperCase();
}

function filterJobsByScope(
  jobs: ReportJob[],
  options: {
    scopeToInitialAsset: boolean;
    initialAssetType: AssetType;
    initialTicker: string;
  },
) {
  if (!options.scopeToInitialAsset) {
    return jobs;
  }

  const scopedTicker = normalizeTicker(options.initialTicker);
  if (!scopedTicker) {
    return jobs;
  }

  return jobs.filter(
    (job) => job.assetType === options.initialAssetType && normalizeTicker(job.ticker) === scopedTicker,
  );
}

function formatSourceLabel(source: ReportAnalysisPayload["analysis"]["source"]) {
  if (source.sourceKind === "MANUAL_UPLOAD") {
    return source.originalFileName ?? "Arquivo enviado pelo usuário";
  }

  if (source.title && source.publisher) {
    return `${source.title} · ${source.publisher}`;
  }

  if (source.title) {
    return source.title;
  }

  if (source.publisher) {
    return source.publisher;
  }

  return source.discoveryMethod === "OFFICIAL_IR_WEB_SEARCH"
    ? "Documento oficial localizado via busca web"
    : "Fonte automática por ticker";
}

function mergeJobs(current: ReportJob[], incoming: ReportJob[]) {
  const byId = new Map<string, ReportJob>();

  for (const job of current) {
    byId.set(job.id, job);
  }

  for (const job of incoming) {
    byId.set(job.id, job);
  }

  return Array.from(byId.values()).sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

async function fileToBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export function OnDemandReportCard({
  initialAssetType = "STOCK",
  initialTicker = "",
  editable = false,
  scopeToInitialAsset = false,
  title = "Relatório por ticker",
  subtitle = "",
}: {
  initialAssetType?: AssetType;
  initialTicker?: string;
  editable?: boolean;
  scopeToInitialAsset?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const toast = useToast();
  const [assetType, setAssetType] = useState<AssetType>(initialAssetType);
  const [ticker, setTicker] = useState(initialTicker);
  const [pendingAction, setPendingAction] = useState<"auto" | "manual" | null>(null);
  const [currentJob, setCurrentJob] = useState<ReportJob | null>(null);
  const [jobHistory, setJobHistory] = useState<ReportJob[]>([]);
  const [analysisResult, setAnalysisResult] = useState<ReportAnalysisPayload | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const completionToastJobIdRef = useRef<string | null>(null);
  const loadedAnalysisJobIdRef = useRef<string | null>(null);

  const loading = pendingAction !== null;

  const scopedJobHistory = useMemo(
    () =>
      filterJobsByScope(jobHistory, {
        scopeToInitialAsset,
        initialAssetType,
        initialTicker,
      }),
    [jobHistory, scopeToInitialAsset, initialAssetType, initialTicker],
  );

  const autoModeJobs = useMemo(
    () => scopedJobHistory.filter((job) => job.requestMode === "AUTO_WEB"),
    [scopedJobHistory],
  );

  const manualModeJobs = useMemo(
    () => scopedJobHistory.filter((job) => job.requestMode === "MANUAL_UPLOAD"),
    [scopedJobHistory],
  );

  const bullets = useMemo(() => {
    if (!analysisResult?.analysis.analysisText) return [];

    return analysisResult.analysis.analysisText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("•") || line.startsWith("-"))
      .map((line) => line.slice(1).trim());
  }, [analysisResult]);

  const parsedBullets = useMemo(() => parseValuationBullets(bullets), [bullets]);
  const valuationInsights = parsedBullets.insights;
  const regularBullets = parsedBullets.remaining;

  useEffect(() => {
    let ignore = false;

    async function loadJobHistory() {
      try {
        const response = await fetch("/api/reports/jobs", { cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as { jobs?: ReportJob[]; error?: string };

        if (!response.ok) {
          if (!ignore) {
            setIsLoadingHistory(false);
          }
          return;
        }

        if (ignore) {
          return;
        }

        const jobs = data.jobs ?? [];
        const visibleJobs = filterJobsByScope(jobs, {
          scopeToInitialAsset,
          initialAssetType,
          initialTicker,
        });
        setJobHistory(jobs);
        setCurrentJob((previous) => {
          if (previous) {
            return jobs.find((job) => job.id === previous.id) ?? previous;
          }

          return visibleJobs.find((job) => !isTerminalJob(job.status)) ?? visibleJobs[0] ?? null;
        });
      } finally {
        if (!ignore) {
          setIsLoadingHistory(false);
        }
      }
    }

    void loadJobHistory();

    return () => {
      ignore = true;
    };
  }, [scopeToInitialAsset, initialAssetType, initialTicker]);

  useEffect(() => {
    if (!scopeToInitialAsset) {
      return;
    }

    setCurrentJob((previous) => {
      if (!previous) {
        return scopedJobHistory.find((job) => !isTerminalJob(job.status)) ?? scopedJobHistory[0] ?? null;
      }

      const stillVisible = scopedJobHistory.some((job) => job.id === previous.id);
      if (stillVisible) {
        return previous;
      }

      return scopedJobHistory.find((job) => !isTerminalJob(job.status)) ?? scopedJobHistory[0] ?? null;
    });
  }, [scopeToInitialAsset, scopedJobHistory]);

  useEffect(() => {
    if (!currentJob || isTerminalJob(currentJob.status)) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/reports/jobs/${currentJob.id}`, { cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as { job?: ReportJob; error?: string };

        if (!response.ok || !data.job) {
          return;
        }

        setCurrentJob(data.job);
        setJobHistory((previous) => mergeJobs(previous, [data.job!]));
      } catch {
        return;
      }
    }, 2500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentJob]);

  useEffect(() => {
    if (!currentJob || !isTerminalJob(currentJob.status)) {
      return;
    }

    const job = currentJob;

    if (job.status === "COMPLETED" && job.analysisId) {
      if (loadedAnalysisJobIdRef.current === job.id) {
        return;
      }

      let ignore = false;

      async function loadAnalysis() {
        const response = await fetch(`/api/reports/analysis/${job.analysisId}`, {
          cache: "no-store",
        });
        const data = (await response.json().catch(() => ({}))) as Partial<ReportAnalysisPayload> & {
          error?: string;
        };

        if (!response.ok) {
          if (!ignore) {
            const message = errorMessageForCode(data.error);
            setLastError(message);
            toast.error(message);
          }
          return;
        }

        if (ignore) {
          return;
        }

        loadedAnalysisJobIdRef.current = job.id;
        setAnalysisResult(data as ReportAnalysisPayload);
        setLastError(null);

        if (completionToastJobIdRef.current !== job.id) {
          completionToastJobIdRef.current = job.id;
          toast.success("Análise concluída e leitura liberada.");
        }
      }

      void loadAnalysis();

      return () => {
        ignore = true;
      };
    }

    if (job.status !== "COMPLETED" && completionToastJobIdRef.current !== job.id) {
      completionToastJobIdRef.current = job.id;
      const message = errorMessageForCode(job.failureCode ?? job.failureMessage ?? undefined);
      setLastError(message);
      setAnalysisResult(null);
      toast.error(message);
    }
  }, [currentJob, toast]);

  async function submitJob(options: {
    path: string;
    payload: Record<string, unknown>;
    action: "auto" | "manual";
  }) {
    setPendingAction(options.action);
    setLastError(null);
    setAnalysisResult(null);
    try {
      const response = await fetch(options.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options.payload),
      });
      const data = (await response.json().catch(() => ({}))) as {
        job?: ReportJob;
        error?: string;
        blockedUntil?: string;
      };

      if (!response.ok) {
        const cooldownSuffix = data.blockedUntil
          ? ` Tente novamente após ${formatDate(data.blockedUntil)}.`
          : "";
        const errorMessage = `${errorMessageForCode(data.error)}${cooldownSuffix}`;
        setLastError(errorMessage);
        toast.error(errorMessage);
        return;
      }

      if (!data.job) {
        throw new Error("JOB_NOT_CREATED");
      }

      loadedAnalysisJobIdRef.current = null;
      completionToastJobIdRef.current = null;
      setCurrentJob(data.job);
      setJobHistory((previous) => mergeJobs(previous, [data.job!]));
      setTicker(normalizeTicker((options.payload.ticker as string | undefined) ?? ticker));
      toast.success(
        options.action === "manual"
          ? "Arquivo recebido. Vamos validar e gerar sua leitura."
          : "Solicitação recebida. Estamos preparando sua leitura."
      );
    } catch {
      const message = "Não foi possível se conectar ao servidor agora.";
      setLastError(message);
      toast.error(message);
    } finally {
      setPendingAction(null);
    }
  }

  async function inspectJob(job: ReportJob) {
    setCurrentJob(job);
    setLastError(null);

    if (!job.analysisId || job.status !== "COMPLETED") {
      setAnalysisResult(null);
      return;
    }

    loadedAnalysisJobIdRef.current = null;
    const response = await fetch(`/api/reports/analysis/${job.analysisId}`, { cache: "no-store" });
    const data = (await response.json().catch(() => ({}))) as Partial<ReportAnalysisPayload> & {
      error?: string;
    };

    if (!response.ok) {
      const message = errorMessageForCode(data.error);
      setLastError(message);
      toast.error(message);
      return;
    }

    loadedAnalysisJobIdRef.current = job.id;
    setAnalysisResult(data as ReportAnalysisPayload);
  }

  async function handleAnalyze() {
    const normalizedTicker = normalizeTicker(ticker);
    if (!normalizedTicker) {
      toast.error("Digite um ticker para continuar.");
      return;
    }

    await submitJob({
      path: "/api/reports/jobs",
      payload: { assetType, ticker: normalizedTicker },
      action: "auto",
    });
  }

  async function handleManualUpload() {
    const normalizedTicker = normalizeTicker(ticker);
    if (!normalizedTicker) {
      toast.error("Digite um ticker antes de enviar o arquivo.");
      return;
    }

    if (!manualFile) {
      toast.error("Selecione um arquivo para continuar.");
      return;
    }

    if (manualFile.size > MANUAL_UPLOAD_MAX_BYTES) {
      const message = "O arquivo é muito grande. Envie um documento de até 10 MB.";
      setLastError(message);
      toast.error(message);
      return;
    }

    const fileBase64 = await fileToBase64(manualFile);
    await submitJob({
      path: "/api/reports/jobs/manual",
      payload: {
        assetType,
        ticker: normalizedTicker,
        originalFileName: manualFile.name,
        contentType: manualFile.type || "application/octet-stream",
        fileBase64,
      },
      action: "manual",
    });
  }

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <Card.Header>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
      </Card.Header>

      <Card.Body className="space-y-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Cobrança apenas em sucesso final. Se não conseguirmos concluir, nenhum crédito é debitado.
        </div>

        <div className={`grid gap-3 ${editable ? "md:grid-cols-[160px_minmax(0,1fr)]" : "md:grid-cols-1"}`}>
          {editable ? (
            <Select
              name="assetType"
              value={assetType}
              onChange={(event) => setAssetType(event.target.value as AssetType)}
              options={assetTypeOptions}
              containerClassName="mb-0"
            />
          ) : null}

          <Input
            name="ticker"
            label={editable ? "Ticker" : undefined}
            value={ticker}
            onChange={(event) => setTicker(normalizeTicker(event.target.value))}
            placeholder={assetType === "FII" ? "Ex.: MXRF11" : "Ex.: PETR4"}
            containerClassName="mb-0"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[var(--foreground)]">Análise por busca automática</p>
              <p className="text-sm text-slate-500">
                Tenta localizar automaticamente uma fonte confiável para o ticker e segue a análise com cobrança apenas em sucesso.
              </p>
            </div>

            <div className="mt-4 flex items-end">
              <Button onClick={handleAnalyze} disabled={loading}>
                {pendingAction === "auto"
                  ? "Iniciando…"
                  : currentJob && !isTerminalJob(currentJob.status)
                    ? "Nova solicitação"
                    : analysisResult
                      ? "Atualizar leitura"
                      : "Gerar leitura"}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[var(--foreground)]">Análise com envio de RI</p>
              <p className="text-sm text-slate-500">
                Envie um documento do ativo para gerar a leitura nesse modo. Esse fluxo não se mistura com a busca automática.
              </p>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="space-y-2">
                <label htmlFor="manual-report-file" className="text-sm font-medium text-[var(--foreground)]">
                  Arquivo do relatório
                </label>
                <input
                  id="manual-report-file"
                  aria-label="Arquivo do relatório"
                  type="file"
                  accept=".pdf,.txt,.md,.csv,.json,.html,.htm,text/plain,application/pdf"
                  onChange={(event) => setManualFile(event.target.files?.[0] ?? null)}
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                />
                <p className="text-xs text-slate-500">
                  {manualFile
                  ? `Arquivo pronto para envio: ${manualFile.name}`
                  : "Aceitamos arquivos de até 10 MB em PDF, TXT, MD, CSV, JSON ou HTML."}
                </p>
              </div>

              <div className="flex items-end">
                <Button onClick={handleManualUpload} disabled={loading || !manualFile}>
                  {pendingAction === "manual"
                    ? "Enviando arquivo…"
                    : currentJob && !isTerminalJob(currentJob.status)
                      ? "Nova solicitação com arquivo"
                      : "Gerar leitura com arquivo"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {currentJob ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Solicitação atual · {currentJob.ticker} · {currentJob.assetType === "FII" ? "FII" : "Ação"}
                </p>
                <p className="text-xs text-slate-500">
                  {formatRequestMode(currentJob.requestMode)} · criado em {formatDate(currentJob.createdAt)}
                </p>
              </div>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusToneClass(currentJob.status)}`}>
                {formatJobStatus(currentJob.status)}
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{formatJobStatus(currentJob.status)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cobrança</p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                  {currentJob.priceCharged ? formatCurrency(currentJob.priceCharged) : "Somente em sucesso"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tentativas</p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{currentJob.attemptCount}</p>
              </div>
            </div>

            {currentJob.status !== "COMPLETED" ? (
              <p className="mt-4 text-sm text-slate-500">
                A leitura do relatório só é liberada quando o processamento atingir o estado <span className="font-semibold text-[var(--foreground)]">Concluído</span>.
              </p>
            ) : null}
          </div>
        ) : null}

        {analysisResult ? (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Leitura</p>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">Liberada</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Acesso até</p>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{formatDate(analysisResult.access.expiresAt)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Validade da análise</p>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{formatDate(analysisResult.analysis.validUntil)}</p>
            </div>
          </div>
        ) : null}

        {lastError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>{lastError}</p>
            {lastError.includes("Saldo insuficiente") ? (
              <Link href="/dashboard/creditos" className="mt-2 inline-flex text-sm font-semibold text-red-700 underline">
                Ir para recarga de créditos
              </Link>
            ) : null}
          </div>
        ) : null}

        {scopedJobHistory.length > 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">Solicitações recentes por modalidade</p>
                <p className="text-sm text-slate-500">
                  {scopeToInitialAsset
                    ? "Mostrando apenas as análises do ativo desta tela, separadas por fluxo."
                    : "Acompanhe o andamento e reabra uma análise já concluída."}
                </p>
              </div>
              {isLoadingHistory ? <span className="text-xs text-slate-400">Atualizando…</span> : null}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-[var(--foreground)]">Busca automática</p>
                <div className="mt-3 space-y-3">
                  {autoModeJobs.slice(0, 6).map((job) => (
                    <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {job.ticker} · {job.assetType === "FII" ? "FII" : "Ação"}
                        </p>
                        <p className="text-xs text-slate-500">{formatDate(job.createdAt)}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusToneClass(job.status)}`}>
                          {formatJobStatus(job.status)}
                        </span>
                        <Button variant="outline" onClick={() => void inspectJob(job)}>
                          {job.analysisId && job.status === "COMPLETED" ? "Abrir análise" : "Ver status"}
                        </Button>
                      </div>
                    </div>
                  ))}
                  {autoModeJobs.length === 0 ? (
                    <p className="text-xs text-slate-500">Sem solicitações automáticas para este contexto.</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-[var(--foreground)]">Upload manual (RI)</p>
                <div className="mt-3 space-y-3">
                  {manualModeJobs.slice(0, 6).map((job) => (
                    <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {job.ticker} · {job.assetType === "FII" ? "FII" : "Ação"}
                        </p>
                        <p className="text-xs text-slate-500">{formatDate(job.createdAt)}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusToneClass(job.status)}`}>
                          {formatJobStatus(job.status)}
                        </span>
                        <Button variant="outline" onClick={() => void inspectJob(job)}>
                          {job.analysisId && job.status === "COMPLETED" ? "Abrir análise" : "Ver status"}
                        </Button>
                      </div>
                    </div>
                  ))}
                  {manualModeJobs.length === 0 ? (
                    <p className="text-xs text-slate-500">Sem solicitações por upload manual para este contexto.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {analysisResult ? (
          <div className="rounded-2xl border border-slate-200 bg-[var(--background-secondary)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {analysisResult.analysis.ticker} · {analysisResult.analysis.assetType === "FII" ? "FII" : "Ação"}
                </p>
                <p className="text-xs text-slate-500">
                  Acesso liberado até {formatDate(analysisResult.access.expiresAt)} · validade da análise até {formatDate(analysisResult.analysis.validUntil)}
                </p>
                <div className="mt-1 space-y-1 text-xs text-slate-500">
                  <p>
                    Fonte: {formatSourceLabel(analysisResult.analysis.source)}
                  </p>
                  {analysisResult.analysis.source.sourceType ? (
                    <p>Tipo: {analysisResult.analysis.source.sourceType}</p>
                  ) : null}
                  {analysisResult.analysis.source.sourceUrl ? (
                    <a
                      href={analysisResult.analysis.source.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex font-semibold text-[var(--primary)] underline"
                    >
                      Abrir fonte da informação
                    </a>
                  ) : null}
                </div>
              </div>
              <Link href="/dashboard/creditos" className="text-xs font-semibold text-[var(--primary)] underline">
                Gerenciar créditos
              </Link>
            </div>

            {valuationInsights.length > 0 ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {valuationInsights.map((insight) => {
                  const isGraham = insight.method === "GRAHAM";
                  const accentClass = isGraham
                    ? "border-emerald-300 bg-emerald-950/[0.06]"
                    : "border-blue-300 bg-blue-950/[0.05]";
                  const formulaClass = isGraham
                    ? "border-emerald-300/60 bg-emerald-900/20 text-emerald-100"
                    : "border-blue-300/60 bg-blue-900/20 text-blue-100";
                  const barFill =
                    insight.currentPrice != null && insight.fairPrice != null && insight.fairPrice > 0
                      ? Math.min(100, (insight.currentPrice / insight.fairPrice) * 100)
                      : 0;
                  const potentialPositive = (insight.potentialPercent ?? 0) >= 0;

                  return (
                    <article key={`${analysisResult.analysis.id}-${insight.method}`} className={`rounded-2xl border p-4 ${accentClass}`}>
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-lg font-semibold text-[var(--foreground)]">{insight.title}</h4>
                        <span className="inline-flex rounded-full border border-white/20 bg-black/20 px-2 py-1 text-xs font-semibold text-white/90">
                          {insight.badge}
                        </span>
                      </div>

                      <div className={`mt-4 rounded-xl border p-3 ${formulaClass}`}>
                        <p className="text-sm font-semibold">Fórmula: {insight.formula}</p>
                        <p className="mt-1 text-xs text-white/80">{insight.description}</p>
                      </div>

                      <div className="mt-4 rounded-xl border border-slate-700/40 bg-slate-950/40 p-3">
                        <p className="text-sm font-semibold text-white">Resultado {insight.method === "GRAHAM" ? "Graham" : "Bazin"}</p>

                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex items-center justify-between gap-3 border-b border-slate-700/40 pb-2">
                            <span className="text-slate-200">{insight.fairLabel}</span>
                            <span className="font-semibold text-white">
                              {insight.fairPrice != null ? formatCurrency(String(insight.fairPrice)) : "—"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-200">Potencial de Valorização</span>
                            <span className={`font-semibold ${potentialPositive ? "text-emerald-300" : "text-rose-300"}`}>
                              {insight.potentialPercent != null ? formatPercent(insight.potentialPercent) : "—"}
                              <span className="ml-2 rounded-md border border-white/20 px-1.5 py-0.5 text-xs text-white/90">
                                {insight.potentialLabel}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-200">
                          <span>Preço Atual</span>
                          <span>{insight.badge}</span>
                        </div>
                        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-700/50">
                          <div
                            className={`h-full rounded-full ${potentialPositive ? "bg-emerald-500" : "bg-blue-500"}`}
                            style={{ width: `${barFill}%` }}
                          />
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-slate-300">
                          <span>{insight.currentPrice != null ? formatCurrency(String(insight.currentPrice)) : "—"}</span>
                          <span>{insight.fairPrice != null ? formatCurrency(String(insight.fairPrice)) : "—"}</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}

            {regularBullets.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-3">
                {regularBullets.map((bullet, index) => (
                  <li key={`${analysisResult.analysis.id}-${index}`} className="flex gap-2 text-sm text-[var(--foreground)]">
                    <span className="mt-0.5 shrink-0 text-[var(--primary)]">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <pre className="mt-4 whitespace-pre-wrap text-sm text-[var(--foreground)]">{analysisResult.analysis.analysisText}</pre>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Gere uma solicitação por ticker para localizar a melhor base e acompanhe o status até a conclusão. Se a origem automática falhar, use o envio de arquivo.
          </p>
        )}
      </Card.Body>
    </Card>
  );
}