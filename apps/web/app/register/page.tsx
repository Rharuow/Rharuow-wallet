import Image from "next/image";
import { RegisterForm } from "./RegisterForm";

export const metadata = {
  title: "Criar conta — RharouWallet",
  description: "Cadastre-se para começar a gerenciar seus investimentos",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string;
    pendingVerification?: string;
    source?: string;
  }>;
}) {
  const { email, pendingVerification, source } = await searchParams;
  const shouldShowPendingVerification = pendingVerification === "1" && Boolean(email);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Image
            src="/logo.png"
            alt="RharouWallet"
            loading="eager"
            width={280}
            height={100}
            priority
            className="object-contain"
            style={{ width: 280, height: 100 }}
          />
        </div>

        <RegisterForm
          initialEmail={shouldShowPendingVerification ? email ?? "" : ""}
          initialSubmitted={shouldShowPendingVerification}
          initialVerificationContext={source === "login" ? "inactive-login" : "registration"}
        />

        <p className="mt-6 text-center text-xs text-slate-400">
          Já tem uma conta?{" "}
          <a
            href="/login"
            className="font-medium text-[var(--primary)] hover:underline"
          >
            Entrar
          </a>
        </p>
      </div>
    </main>
  );
}
