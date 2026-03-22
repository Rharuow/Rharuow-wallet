import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { DashboardShell } from "./DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();

  if (!user) {
    // Redireciona via logout para garantir que o cookie seja limpo antes
    // de voltar ao login — evita loop infinito quando o token é inválido.
    redirect("/api/auth/logout");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
