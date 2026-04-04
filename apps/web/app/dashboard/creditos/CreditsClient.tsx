"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, useToast } from "rharuow-ds";

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

export function CreditsClient() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [balance, setBalance] = useState<BalancePayload["balance"] | null>(null);
  const [entries, setEntries] = useState<LedgerPayload["entries"]>([]);
  const [loading, setLoading] = useState(true);
  const [processingAmount, setProcessingAmount] = useState<number | null>(null);

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

  useEffect(() => {
    const creditTopup = searchParams.get("credit_topup");
    if (!creditTopup) return;

    if (creditTopup === "success") {
      toast.success("Pagamento confirmado. Atualizando seu saldo de créditos.");
      void loadCredits();
    }

    if (creditTopup === "cancelled") {
      toast.info("A recarga foi cancelada antes da confirmação do pagamento.");
    }

    router.replace("/dashboard/creditos");
  }, [router, searchParams, toast]);

  async function handleTopup(amount: number) {
    setProcessingAmount(amount);
    try {
      const response = await fetch("/api/credits/topups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
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
              Free paga {formatCurrency(2.5)} por análise concluída. Premium paga {formatCurrency(1.5)}. Falhas antes da geração e relatório não encontrado não consomem saldo.
            </div>
          </Card.Body>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <Card.Header>
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Recarregar créditos</h2>
              <p className="text-sm text-slate-500">Checkout Stripe com cartão ou PIX.</p>
            </div>
          </Card.Header>
          <Card.Body className="space-y-3">
            {suggestedTopups.map((amount) => (
              <Button
                key={amount}
                onClick={() => handleTopup(amount)}
                disabled={processingAmount !== null}
                className="w-full justify-center"
              >
                {processingAmount === amount ? "Redirecionando…" : `Adicionar ${formatCurrency(amount)}`}
              </Button>
            ))}
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