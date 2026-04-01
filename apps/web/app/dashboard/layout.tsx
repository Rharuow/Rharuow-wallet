import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { DashboardShell } from "./DashboardShell";
import { getWalletContext } from "@/lib/wallet";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, walletContext] = await Promise.all([
    getAuthUser(),
    getWalletContext(),
  ]);

  if (!user) {
    // Redireciona via logout para garantir que o cookie seja limpo antes
    // de voltar ao login — evita loop infinito quando o token é inválido.
    redirect("/api/auth/logout");
  }

  if (!walletContext) {
    redirect("/api/auth/logout");
  }

  return <DashboardShell walletContext={walletContext}>{children}</DashboardShell>;
}
