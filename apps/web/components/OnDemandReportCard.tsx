"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Card, Input, Select, useToast } from "rharuow-ds";

type AssetType = "STOCK" | "FII";

type AnalysisResponse = {
  outcome: "ACTIVE_ACCESS" | "REUSED" | "GENERATED";
  chargedAmount: string;
  plan: "FREE" | "PREMIUM";
  balance: { id: string; balance: string; updatedAt: string };
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
    };
  };
};

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

  if (error === "REPORT_SOURCE_NOT_FOUND") {
    return "Não encontramos um relatório automaticamente para esse ticker. Se quiser, você pode enviar um arquivo logo abaixo.";
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
  title = "Relatório on-demand",
  subtitle = "Busca automática do documento-base, reuso inteligente e acesso por 30 dias.",
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
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [manualFile, setManualFile] = useState<File | null>(null);

  const loading = pendingAction !== null;

  const bullets = useMemo(() => {
    if (!result?.analysis.analysisText) return [];

    return result.analysis.analysisText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("•") || line.startsWith("-"))
      .map((line) => line.slice(1).trim());
  }, [result]);

  async function submitAnalysis(options: {
    path: string;
    payload: Record<string, unknown>;
    action: "auto" | "manual";
  }) {
    setPendingAction(options.action);
    setLastError(null);
    try {
      const response = await fetch(options.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options.payload),
      });
      const data = (await response.json().catch(() => ({}))) as Partial<AnalysisResponse> & {
        error?: string;
      };

      if (!response.ok) {
        const errorMessage = errorMessageForCode(data.error);
        setLastError(errorMessage);
        toast.error(errorMessage);
        return;
      }

      setResult(data as AnalysisResponse);
      setTicker(((options.payload.ticker as string | undefined) ?? ticker).trim().toUpperCase());
      toast.success(
        data.outcome === "ACTIVE_ACCESS"
          ? "Essa análise já está disponível para você"
          : data.outcome === "REUSED"
            ? "Encontramos uma análise pronta para você"
            : "Sua análise foi gerada com sucesso"
      );
    } catch {
      const message = "Não foi possível se conectar ao servidor agora.";
      setLastError(message);
      toast.error(message);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleAnalyze() {
    const normalizedTicker = ticker.trim().toUpperCase();
    if (!normalizedTicker) {
      toast.error("Digite um ticker para continuar.");
      return;
    }

    await submitAnalysis({
      path: "/api/reports/analysis",
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
    await submitAnalysis({
      path: "/api/reports/analysis",
      payload: {
        manualUpload: true,
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
          Cobrança por sucesso: Free {formatCurrency("2.5")} e Premium {formatCurrency("1.5")}. Se o relatório não for encontrado ou a geração falhar, não há débito.
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
              {pendingAction === "auto" ? "Analisando…" : result ? "Atualizar análise" : "Desbloquear análise"}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--foreground)]">Enviar relatório do seu computador</p>
            <p className="text-sm text-slate-500">
              Se não encontrarmos um relatório automaticamente, você pode enviar um arquivo para continuar a análise.
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
                {pendingAction === "manual" ? "Enviando arquivo…" : "Analisar com arquivo enviado"}
              </Button>
            </div>
          </div>
        </div>

        {result ? (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resultado</p>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                {result.outcome === "ACTIVE_ACCESS"
                  ? "Acesso ativo"
                  : result.outcome === "REUSED"
                    ? "Análise reaproveitada"
                    : "Análise gerada"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cobrança</p>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{formatCurrency(result.chargedAmount)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saldo atual</p>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{formatCurrency(result.balance.balance)}</p>
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

        {result ? (
          <div className="rounded-2xl border border-slate-200 bg-[var(--background-secondary)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {result.analysis.ticker} · {result.analysis.assetType === "FII" ? "FII" : "Ação"}
                </p>
                <p className="text-xs text-slate-500">
                  Acesso liberado até {formatDate(result.access.expiresAt)} · validade da análise até {formatDate(result.analysis.validUntil)}
                </p>
                <p className="text-xs text-slate-500">
                  {result.analysis.source.sourceKind === "MANUAL_UPLOAD"
                    ? `Origem manual: ${result.analysis.source.originalFileName ?? "arquivo enviado"}`
                    : "Origem automática por ticker"}
                </p>
              </div>
              <Link href="/dashboard/creditos" className="text-xs font-semibold text-[var(--primary)] underline">
                Gerenciar créditos
              </Link>
            </div>

            {bullets.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-3">
                {bullets.map((bullet, index) => (
                  <li key={`${result.analysis.id}-${index}`} className="flex gap-2 text-sm text-[var(--foreground)]">
                    <span className="mt-0.5 shrink-0 text-[var(--primary)]">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <pre className="mt-4 whitespace-pre-wrap text-sm text-[var(--foreground)]">{result.analysis.analysisText}</pre>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Busque por ticker para localizar o documento-base, reutilizar análises existentes quando possível e liberar acesso por 30 dias. Se a origem automática falhar, use o upload manual.
          </p>
        )}
      </Card.Body>
    </Card>
  );
}