import { getAuthUser, getAuthToken } from "@/lib/auth";
import { fetchMarketAssets } from "@/lib/market";
import { MarketOverview } from "@/components/MarketOverview";
import Link from "next/link";
import { getWalletContext } from "@/lib/wallet";

export const metadata = {
  title: "Home — RharouWallet",
};

async function getPlan(token: string): Promise<"FREE" | "PREMIUM"> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const res = await fetch(`${API_BASE}/v1/payments/status`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return "FREE";
    const data = await res.json();
    return data.plan ?? "FREE";
  } catch {
    return "FREE";
  }
}

export default async function DashboardHome() {
  const token = await getAuthToken();
  const [user, assets, plan, walletContext] = await Promise.all([
    getAuthUser(),
    fetchMarketAssets(),
    token ? getPlan(token) : Promise.resolve<"FREE" | "PREMIUM">("FREE"),
    getWalletContext(),
  ]);

  const showUpgradeBanner =
    !plan || plan === "FREE";

  if (walletContext?.isShared) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Carteira de {walletContext.activeWallet.ownerName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Use os atalhos abaixo para navegar pela carteira compartilhada ativa.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/dashboard/custos"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary)]/5"
          >
            <p className="text-sm font-semibold text-[var(--foreground)]">Custos</p>
            <p className="mt-1 text-sm text-slate-500">
              Consulte e gerencie custos conforme sua permissão atual.
            </p>
          </Link>

          <Link
            href="/dashboard/entradas"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary)]/5"
          >
            <p className="text-sm font-semibold text-[var(--foreground)]">Entradas</p>
            <p className="mt-1 text-sm text-slate-500">
              Veja as receitas da carteira compartilhada e faça edições quando permitido.
            </p>
          </Link>
        </div>

        <Link
          href="/dashboard/compartilhamento"
          className="inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
        >
          Gerenciar convites e acessos
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Olá, {user?.name ?? "usuário"} 👋
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Bem-vindo ao RharouWallet.
        </p>
      </div>

      {showUpgradeBanner && (
        <Link
          href="/dashboard/premium"
          className="flex items-center justify-between gap-4 rounded-xl border border-[var(--primary)]/40 bg-[var(--primary)]/5 px-5 py-4 transition-colors hover:bg-[var(--primary)]/10"
        >
          <div>
            <p className="text-sm font-semibold text-[var(--primary)]">
              ✨ Torne-se Premium
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              A partir de R$ 12,90/mês. Acesso completo a todos os recursos.
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-[var(--primary)] px-4 py-1.5 text-xs font-semibold text-white">
            Ver planos
          </span>
        </Link>
      )}

      <MarketOverview assets={assets} />
    </div>
  );
}
