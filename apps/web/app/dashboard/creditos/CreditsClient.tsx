"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Input, useToast } from "rharuow-ds";

type BalancePayload = {
  balance: {
    id: string;
    balance: string;
    updatedAt: string;
  };
};

type LedgerPayload = {
  total: number;
  entries: Array<{
    id: string;
    kind: "CREDIT" | "DEBIT" | "REVERSAL" | "ADJUSTMENT";
    amount: string;
    balanceAfter: string;
    description: string | null;
    createdAt: string;
  }>;
};

const suggestedTopups = [5, 10, 20, 50];
const MIN_TOPUP_AMOUNT = 3;

function formatCurrency(value: string | number) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return String(value);
  }

  return numeric.toLocaleString("pt-BR", {
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

function parseTopupAmount(value: string | number) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return Number.NaN;
  }

  const sanitized = trimmed.replace(/\s+/g, "").replace(/R\$/gi, "");
  const normalized = sanitized.includes(",")
    ? sanitized.replace(/\./g, "").replace(",", ".")
    : sanitized;

  return Number(normalized);
}

export function CreditsClient() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [balance, setBalance] = useState<BalancePayload["balance"] | null>(null);
  const [entries, setEntries] = useState<LedgerPayload["entries"]>([]);
  const [loading, setLoading] = useState(true);
  const [processingAmount, setProcessingAmount] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const handledReturnKeyRef = useRef<string | null>(null);
  const parsedCustomAmount = parseTopupAmount(customAmount);
  const customAmountKey = Number.isFinite(parsedCustomAmount) ? String(Number(parsedCustomAmount.toFixed(2))) : null;
  const isCustomAmountValid =
    Number.isFinite(parsedCustomAmount) && parsedCustomAmount >= MIN_TOPUP_AMOUNT;
  const creditTopup = searchParams.get("credit_topup");
  const creditTopupSessionId = searchParams.get("session_id");

  const loadCredits = useEffectEvent(async () => {
    setLoading(true);
    try {
      const [balanceResponse, ledgerResponse] = await Promise.all([
        fetch("/api/credits/balance", { cache: "no-store" }),
        fetch("/api/credits/ledger?limit=20", { cache: "no-store" }),
      ]);

      const balanceData = (await balanceResponse.json().catch(() => ({}))) as Partial<BalancePayload> & { error?: string };
      const ledgerData = (await ledgerResponse.json().catch(() => ({}))) as Partial<LedgerPayload> & { error?: string };

      if (!balanceResponse.ok) {
        throw new Error(balanceData.error ?? "Erro ao carregar saldo.");
      }

      if (!ledgerResponse.ok) {
        throw new Error(ledgerData.error ?? "Erro ao carregar extrato.");
      }

      setBalance(balanceData.balance ?? null);
      setEntries(ledgerData.entries ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar créditos.");
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void loadCredits();
  }, []);

  const handleCreditTopupReturn = useEffectEvent(async (status: string, sessionId?: string | null) => {
    if (status === "success") {
      if (sessionId) {
        const activationResponse = await fetch("/api/payments/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        if (!activationResponse.ok) {
          const activationData = (await activationResponse.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(activationData.error ?? "Não foi possível confirmar a recarga.");
        }
      }

      await loadCredits();
      toast.success("Pagamento confirmado. Atualizando seu saldo de créditos.");
    }

    if (status === "cancelled") {
      toast.info("A recarga foi cancelada antes da confirmação do pagamento.");
    }

    router.replace("/dashboard/creditos");
  });

  useEffect(() => {
    if (!creditTopup) return;

    const returnKey = `${creditTopup}:${creditTopupSessionId ?? ""}`;
    if (handledReturnKeyRef.current === returnKey) {
      return;
    }

    handledReturnKeyRef.current = returnKey;
    void handleCreditTopupReturn(creditTopup, creditTopupSessionId);
  }, [creditTopup, creditTopupSessionId]);

  async function handleTopup(amount: number) {
    const normalizedAmount = Number(amount.toFixed(2));

    if (!Number.isFinite(normalizedAmount) || normalizedAmount < MIN_TOPUP_AMOUNT) {
      toast.error(`Informe um valor minimo de ${formatCurrency(MIN_TOPUP_AMOUNT)}.`);
      return;
    }

    setProcessingAmount(String(normalizedAmount));
    try {
      const response = await fetch("/api/credits/topups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: normalizedAmount }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        checkoutUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.checkoutUrl) {
        toast.error(data.error ?? "Não foi possível iniciar a recarga.");
        return;
      }

      window.location.href = data.checkoutUrl;
    } catch {
      toast.error("Erro ao conectar com o servidor.");
    } finally {
      setProcessingAmount(null);
    }
  }

  async function handleCustomTopup() {
    const amount = parseTopupAmount(customAmount);

    if (!Number.isFinite(amount)) {
      toast.error("Informe um valor válido para a recarga.");
      return;
    }

    await handleTopup(amount);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="border-slate-200 bg-white shadow-sm">
          <Card.Header>
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Saldo disponível</h2>
              <p className="text-sm text-slate-500">Use seus créditos para desbloquear relatórios on-demand de ações e FIIs.</p>
            </div>
          </Card.Header>
          <Card.Body className="space-y-4">
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Carteira</p>
              <p className="mt-2 text-4xl font-semibold text-emerald-950">
                {loading ? "…" : formatCurrency(balance?.balance ?? "0")}
              </p>
              <p className="mt-2 text-sm text-emerald-800">
                Última atualização {balance?.updatedAt ? formatDate(balance.updatedAt) : "agora"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Análises on-demand consomem créditos apenas quando o processamento conclui com sucesso. Falhas antes da geração e relatório não encontrado não consomem saldo.
            </div>
          </Card.Body>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <Card.Header>
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Recarregar créditos</h2>
              <p className="text-sm text-slate-500">Checkout Stripe com cartão e PIX quando disponível na sua conta.</p>
            </div>
          </Card.Header>
          <Card.Body className="flex flex-col gap-4">
            {suggestedTopups.map((amount) => (
              <Button
                key={amount}
                onClick={() => handleTopup(amount)}
                disabled={processingAmount !== null}
                className="w-full justify-center"
              >
                {processingAmount === String(amount) ? "Redirecionando…" : `Adicionar ${formatCurrency(amount)}`}
              </Button>
            ))}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3">
                <Input
                  name="customTopupAmount"
                  label="Valor personalizado"
                  placeholder="R$ 0,00"
                  currency
                  currencyCode="BRL"
                  currencyLocale="pt-BR"
                  currencyValueType="string"
                  value={customAmount}
                  onChange={(event) => setCustomAmount(event.target.value)}
                />
                <Button
                  onClick={() => void handleCustomTopup()}
                  disabled={processingAmount !== null || !isCustomAmountValid}
                  className="w-full justify-center"
                >
                  {processingAmount !== null && processingAmount === customAmountKey ? "Redirecionando…" : "Adicionar"}
                </Button>
                <p className="text-xs text-slate-500">
                  Valor minimo por recarga: {formatCurrency(MIN_TOPUP_AMOUNT)}.
                </p>
              </div>
            </div>
            <Link href="/dashboard/relatorios" className="inline-flex text-sm font-semibold text-[var(--primary)] underline">
              Ir para análises on-demand
            </Link>
          </Card.Body>
        </Card>
      </div>

      <Card className="border-slate-200 bg-white shadow-sm">
        <Card.Header>
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Extrato recente</h2>
            <p className="text-sm text-slate-500">Créditos de recarga e débitos por desbloqueio de análises.</p>
          </div>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <p className="text-sm text-slate-500">Carregando extrato…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma movimentação registrada ainda.</p>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div key={entry.id} className="flex flex-col gap-2 rounded-2xl border border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {entry.kind === "CREDIT" ? "Crédito" : entry.kind === "DEBIT" ? "Débito" : entry.kind}
                    </p>
                    <p className="text-xs text-slate-500">{entry.description ?? "Movimentação sem descrição"}</p>
                  </div>
                  <div className="text-sm md:text-right">
                    <p className={`font-semibold ${entry.kind === "CREDIT" ? "text-emerald-700" : "text-rose-700"}`}>
                      {entry.kind === "CREDIT" ? "+" : "-"}{formatCurrency(entry.amount)}
                    </p>
                    <p className="text-xs text-slate-500">Saldo após: {formatCurrency(entry.balanceAfter)} · {formatDate(entry.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}