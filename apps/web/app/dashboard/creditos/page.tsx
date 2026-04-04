import { CreditsClient } from "./CreditsClient";

export const metadata = {
  title: "Créditos — RharouWallet",
};

export default function CreditsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Créditos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Recarregue saldo, acompanhe o extrato e use sua carteira para análises on-demand.
        </p>
      </div>

      <CreditsClient />
    </div>
  );
}