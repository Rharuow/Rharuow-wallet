import { getAuthUser } from "@/lib/auth";

export const metadata = {
  title: "Home — RharouWallet",
};

export default async function DashboardHome() {
  const user = await getAuthUser();

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Olá, {user?.name ?? "usuário"} 👋
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Bem-vindo ao RharouWallet. Selecione uma opção no menu para começar.
      </p>
    </div>
  );
}
