import { CancelClient } from "./CancelClient";

export const metadata = {
  title: "Cancelar assinatura — RharouWallet",
};

export default function CancelPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Cancelar assinatura
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Tem certeza que deseja cancelar?
        </p>
      </div>
      <CancelClient />
    </div>
  );
}
