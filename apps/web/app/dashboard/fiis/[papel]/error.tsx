"use client";

import Link from "next/link";

export default function FiiDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">
        Erro ao carregar FII
      </h1>
      <p className="text-sm text-slate-400 max-w-sm">
        {error.message ?? "Não foi possível carregar os dados deste FII."}
      </p>
      <div className="flex items-center gap-4">
        <button
          onClick={reset}
          className="rounded-lg px-4 py-2 text-sm font-medium bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
        >
          Tentar novamente
        </button>
        <Link
          href="/dashboard/fiis"
          className="text-sm text-slate-400 hover:text-[var(--primary)] transition-colors"
        >
          Voltar para FIIs
        </Link>
      </div>
    </div>
  );
}
