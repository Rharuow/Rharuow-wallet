import { redirect } from "next/navigation";
import { getAuthToken } from "@/lib/auth";

export const metadata = { title: "Ativando Premium — RharouWallet" };

export default async function AtivarPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  if (!session_id) {
    redirect("/dashboard/premium");
  }

  const token = await getAuthToken();

  if (token) {
    const API_BASE =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

    try {
      await fetch(`${API_BASE}/v1/payments/activate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId: session_id }),
        cache: "no-store",
      });
    } catch {
      // Se falhar (ex: já ativado por webhook), segue normalmente
    }
  }

  redirect("/dashboard?upgraded=true");
}
