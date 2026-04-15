"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Input, Select, useToast } from "rharuow-ds";

type AssetType = "STOCK" | "FII";

type RequestMode = "AUTO_WEB" | "MANUAL_UPLOAD";

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

function errorMessageForCode(error?: string) {
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
    return "O arquivo é muito grande. Envie um documento de até 5 MB.";
  }

  if (error === "REPORT_SOURCE_MANUAL_CONTENT_TOO_SHORT") {
    return "Não conseguimos identificar conteúdo suficiente nesse arquivo para gerar a análise.";
  }

  if (error === "REPORT_ANALYSIS_AI_NOT_CONFIGURED") {
    return "A análise está temporariamente indisponível neste ambiente.";
  }

  return error ?? "Não foi possível concluir a análise agora.";
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
  title = "Relatório por ticker",
  subtitle = "",
}: {
  initialAssetType?: AssetType;
  initialTicker?: string;
  editable?: boolean;
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

  const bullets = useMemo(() => {
    if (!analysisResult?.analysis.analysisText) return [];

    return analysisResult.analysis.analysisText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("•") || line.startsWith("-"))
      .map((line) => line.slice(1).trim());
  }, [analysisResult]);

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
        setJobHistory(jobs);
        setCurrentJob((previous) => {
          if (previous) {
            return jobs.find((job) => job.id === previous.id) ?? previous;
          }

          return jobs.find((job) => !isTerminalJob(job.status)) ?? jobs[0] ?? null;
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
  }, []);

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
      setTicker(((options.payload.ticker as string | undefined) ?? ticker).trim().toUpperCase());
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
    const normalizedTicker = ticker.trim().toUpperCase();
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
    const normalizedTicker = ticker.trim().toUpperCase();
    if (!normalizedTicker) {
      toast.error("Digite um ticker antes de enviar o arquivo.");
      return;
    }

    if (!manualFile) {
      toast.error("Selecione um arquivo para continuar.");
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

        <div className={`grid gap-3 ${editable ? "md:grid-cols-[160px_minmax(0,1fr)_auto]" : "md:grid-cols-[minmax(0,1fr)_auto]"}`}>
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
            onChange={(event) => setTicker(event.target.value.toUpperCase())}
            placeholder={assetType === "FII" ? "Ex.: MXRF11" : "Ex.: PETR4"}
            containerClassName="mb-0"
          />

          <div className="flex items-end">
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
            <p className="text-sm font-semibold text-[var(--foreground)]">Enviar relatório do seu computador</p>
            <p className="text-sm text-slate-500">
              Se não encontrarmos um material confiável pelo ticker, você pode enviar um arquivo e seguir por esse caminho.
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
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
                  : "Aceitamos arquivos de até 5 MB em PDF, TXT, MD, CSV, JSON ou HTML."}
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

        {jobHistory.length > 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">Solicitações recentes</p>
                <p className="text-sm text-slate-500">Acompanhe o andamento e reabra uma análise já concluída.</p>
              </div>
              {isLoadingHistory ? <span className="text-xs text-slate-400">Atualizando…</span> : null}
            </div>

            <div className="mt-4 space-y-3">
              {jobHistory.slice(0, 6).map((job) => (
                <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {job.ticker} · {job.assetType === "FII" ? "FII" : "Ação"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatRequestMode(job.requestMode)} · {formatDate(job.createdAt)}
                    </p>
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

            {bullets.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-3">
                {bullets.map((bullet, index) => (
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