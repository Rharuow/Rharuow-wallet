import { Suspense } from "react";
import Image from "next/image";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = {
  title: "Redefinir senha — RharouWallet",
  description: "Redefina sua senha de acesso",
};

export default function ResetPasswordPage() {
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

        {/* Suspense required because ResetPasswordForm uses useSearchParams */}
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
