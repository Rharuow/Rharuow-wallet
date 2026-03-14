"use client";

import Link from "next/link";
import { Card } from "rharuow-ds";

interface Props {
  feature?: string;
}

export function PremiumGate({ feature = "Esta funcionalidade" }: Props) {
  return (
    <Card className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <span className="text-5xl">🔒</span>
      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold text-[var(--foreground)]">
          Acesso Premium necessário
        </p>
        <p className="max-w-sm text-sm text-slate-500">
          {feature} está disponível apenas para assinantes Premium. Faça o
          upgrade e desbloqueie análises completas da sua vida financeira.
        </p>
      </div>
      <Link
        href="/dashboard/premium"
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Ver planos Premium ✨
      </Link>
    </Card>
  );
}
