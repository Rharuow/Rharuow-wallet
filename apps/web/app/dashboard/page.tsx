import { getAuthUser } from "@/lib/auth";
import { fetchMarketAssets } from "@/lib/market";
import { MarketOverview } from "@/components/MarketOverview";

export const metadata = {
  title: "Home — RharouWallet",
};

export default async function DashboardHome() {
  const [user, assets] = await Promise.all([
    getAuthUser(),
    fetchMarketAssets(),
  ]);

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
      <MarketOverview assets={assets} />
    </div>
  );
}
