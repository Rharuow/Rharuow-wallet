"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Chip } from "rharuow-ds";

const MONTHLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY ?? "";
const YEARLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY ?? "";

type Plan = {
  id: string;
  label: string;
  price: string;
  period: string;
  monthlyEquivalent?: string;
  priceId: string;
  highlight?: boolean;
  badge?: string;
};

const PLANS: Plan[] = [
  {
    id: "monthly",
    label: "Mensal",
    price: "R$ 12,90",
    period: "/mês",
    priceId: MONTHLY_PRICE_ID,
  },
  {
    id: "yearly",
    label: "Anual",
    price: "R$ 119,99",
    period: "/ano",
    monthlyEquivalent: "≈ R$ 10,00/mês",
    priceId: YEARLY_PRICE_ID,
    highlight: true,
    badge: "Mais popular",
  },
];

const FEATURES: { icon: string; text: string }[] = [
  { icon: "📈", text: "Cotações ilimitadas de ações e FIIs" },
  { icon: "💰", text: "Gestão completa de custos domésticos" },
  { icon: "📊", text: "Análise e gráficos de carteira" },
  { icon: "⚡", text: "Suporte por e-mail prioritário" },
];

type Props = {
  cancelAtPeriodEnd?: boolean;
  planExpiresAt?: string | null;
  isPremium?: boolean;
};

export function PremiumClient({ cancelAtPeriodEnd, planExpiresAt, isPremium }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe(priceId: string) {
    setLoading(priceId);
    setError(null);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar sessão de pagamento");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
      setLoading(null);
    }
  }

  if (isPremium) {
    const expiryDate = planExpiresAt
      ? new Date(planExpiresAt).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : null;

    return (
      <Card variant="flat" className="border border-[var(--primary)]/30 bg-[var(--primary)]/5">
        <Card.Body className="space-y-5">
          {/* header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)]/10 text-2xl">
                ✨
              </span>
              <div>
                <p className="font-semibold text-[var(--foreground)]">Plano Premium ativo</p>
                {expiryDate && (
                  <p className="text-xs mt-0.5">
                    {cancelAtPeriodEnd ? "Expira em" : "Renova em"} {expiryDate}
                  </p>
                )}
              </div>
            </div>
            <Chip label="Premium" active />
          </div>

          {/* features summary */}
          <ul className="divide-y divide-[var(--primary)]/10 rounded-lg border border-[var(--primary)]/20 bg-white/60 dark:bg-black/10">
            {FEATURES.map((f, index) => (
              <li key={index} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span>{f.icon}</span>
                {f.text}
              </li>
            ))}
          </ul>

          {/* cancellation status */}
          {cancelAtPeriodEnd ? (
            <Card variant="flat" className="border border-amber-200 bg-amber-50">
              <Card.Body>
                <p className="text-sm font-medium text-amber-200">⚠️ Cancelamento agendado</p>
                <p className="mt-1 text-xs text-amber-300">
                  Seu acesso Premium continua ativo até {expiryDate}. Após essa data o plano
                  retorna para o gratuito.
                </p>
              </Card.Body>
            </Card>
          ) : (
            <div className="flex justify-end mt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/dashboard/premium/cancelar")}
                className="text-xs hover:text-red-600"
              >
                Cancelar assinatura
              </Button>
            </div>
          )}
        </Card.Body>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* hero strip */}
      <Card variant="primary" className="text-center" padding="lg">
        <Card.Body className="space-y-1">
          <p className="text-lg font-bold">Desbloqueie tudo com o Premium</p>
          <p className="text-sm opacity-75">
            Invista em controle financeiro real. Cancele quando quiser.
          </p>
        </Card.Body>
      </Card>

      {/* features */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FEATURES.map((f, index) => (
          <div
            key={index}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-100 bg-[var(--background)] p-3 text-center shadow-sm"
          >
            <span className="text-2xl">{f.icon}</span>
            <p className="text-xs leading-snug">{f.text}</p>
          </div>
        ))}
      </div>

      {/* plan cards */}
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider">
          Escolha seu plano
        </p>

        {error && (
          <Card variant="flat" className="border border-red-200 bg-red-50">
            <Card.Body>
              <p className="text-sm text-red-600">⚠️ {error}</p>
            </Card.Body>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {PLANS.map((plan, index) => (
            <div key={index} className="relative">
              {plan.badge && (
                <div className="absolute -top-3 left-0 right-0 flex justify-center z-10">
                  <Chip label={plan.badge} active />
                </div>
              )}
              <Card
                variant={plan.highlight ? "primary" : "outlined"}
                className="flex h-full flex-col"
                padding="md"
              >
                <Card.Header>
                  <p className="text-xs font-medium uppercase tracking-wider opacity-60">
                    {plan.label}
                  </p>
                  <div className="mt-2 flex items-end gap-1">
                    <span className="text-4xl font-extrabold leading-none">{plan.price}</span>
                    <span className="mb-1 text-sm opacity-60">{plan.period}</span>
                  </div>
                  {plan.monthlyEquivalent && (
                    <p className="mt-1 text-xs font-medium opacity-70">
                      💸 {plan.monthlyEquivalent} — economize 22%
                    </p>
                  )}
                </Card.Header>
                <Card.Footer>
                  <Button
                    variant={plan.highlight ? "default" : "outline"}
                    size="md"
                    disabled={!!loading}
                    onClick={() => handleSubscribe(plan.priceId)}
                    className="w-full"
                  >
                    {loading === plan.priceId ? "Aguarde..." : "Assinar agora"}
                  </Button>
                </Card.Footer>
              </Card>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs">
        🔒 Pagamento seguro via Stripe · Cancele quando quiser
      </p>
    </div>
  );
}
