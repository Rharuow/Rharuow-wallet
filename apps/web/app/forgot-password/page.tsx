import Image from "next/image";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = {
  title: "Recuperar senha — RharouWallet",
  description: "Redefina sua senha de acesso",
};

export default function ForgotPasswordPage() {
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

        <ForgotPasswordForm />
      </div>
    </main>
  );
}
