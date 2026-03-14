import { getAuthToken } from "@/lib/auth";
import { PremiumClient } from "./PremiumClient";

export const metadata = {
  title: "Premium — RharouWallet",
};

type PaymentStatus = {
  plan: "FREE" | "PREMIUM";
  planExpiresAt: string | null;
  cancelAtPeriodEnd: boolean;
};

async function getPaymentStatus(token: string): Promise<PaymentStatus | null> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const res = await fetch(`${API_BASE}/v1/payments/status`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function PremiumPage() {
  const token = await getAuthToken();
  const status = token ? await getPaymentStatus(token) : null;
  const isPremium = status?.plan === "PREMIUM";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          {isPremium ? "Sua assinatura" : "Torne-se Premium"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isPremium
            ? "Gerencie seu plano abaixo."
            : "Desbloqueie todos os recursos do RharouWallet."}
        </p>
      </div>

      <PremiumClient
        isPremium={isPremium}
        planExpiresAt={status?.planExpiresAt}
        cancelAtPeriodEnd={status?.cancelAtPeriodEnd}
      />
    </div>
  );
}
