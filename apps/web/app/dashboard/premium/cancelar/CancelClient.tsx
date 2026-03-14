"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "rharuow-ds";

const PERKS = [
  "📈 Cotações ilimitadas de ações e FIIs",
  "💰 Gestão completa de custos domésticos",
  "📊 Análise e gráficos de carteira",
  "⚡ Suporte por e-mail prioritário",
];

export function CancelClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/cancel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao cancelar assinatura");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Card variant="flat" className="border border-amber-200 bg-amber-50">
        <Card.Body className="flex flex-col items-center space-y-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-3xl">
            ⏳
          </span>
          <div>
            <p className="text-lg font-semibold text-amber-200">Cancelamento agendado</p>
            <p className="mt-1 text-sm text-amber-300">
              Você continua com acesso Premium até o fim do período pago. Após o vencimento,
              seu plano retorna automaticamente para o gratuito.
            </p>
          </div>
          <Button size="md" onClick={() => router.push("/dashboard")} className="w-full sm:w-auto">
            Voltar ao dashboard
          </Button>
        </Card.Body>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* what they'll lose */}
      <Card variant="outlined">
        <Card.Header>
          <p className="text-sm font-semibold">
            Você perderá acesso a todos os benefícios Premium:
          </p>
        </Card.Header>
        <Card.Body>
          <ul className="space-y-2">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-2 text-sm">
                <span className="text-base">{perk.split(" ")[0]}</span>
                <span>{perk.split(" ").slice(1).join(" ")}</span>
              </li>
            ))}
          </ul>
        </Card.Body>
      </Card>

      {/* confirmation card */}
      <Card variant="flat" className="border border-red-200 bg-red-50/60">
        <Card.Body className="space-y-4">
          <div className="flex gap-3">
            <span className="mt-0.5 text-xl">⚠️</span>
            <p className="text-sm">
              Ao confirmar, sua assinatura <strong>não será renovada</strong> após o fim do
              período atual. Você mantém o acesso até o vencimento.
            </p>
          </div>

          {error && (
            <Card variant="flat" className="border border-red-200 bg-red-100">
              <Card.Body>
                <p className="text-sm text-red-700">{error}</p>
              </Card.Body>
            </Card>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button
              variant="outline"
              size="md"
              onClick={() => router.back()}
              disabled={loading}
              className="flex-1"
            >
              Manter assinatura
            </Button>
            <Button
              size="md"
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 !bg-red-600 hover:!bg-red-700"
            >
              {loading ? "Cancelando..." : "Confirmar cancelamento"}
            </Button>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
