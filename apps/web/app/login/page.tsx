import Image from "next/image";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Entrar — RharouWallet",
  description: "Acesse sua conta para gerenciar seus investimentos",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

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
            style={{
                width: 280,
                height: 100
            }}
          />
        </div>

  <LoginForm nextPath={next ?? null} />

        <p className="mt-6 text-center text-xs text-slate-400">
          Não tem uma conta?{" "}
          <a
            href="/register"
            className="font-medium text-[var(--primary)] hover:underline"
          >
            Cadastre-se
          </a>
        </p>
      </div>
    </main>
  );
}
