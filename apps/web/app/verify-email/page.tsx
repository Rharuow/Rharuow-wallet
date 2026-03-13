import { VerifyEmailClient } from "./VerifyEmailClient";

export const metadata = {
  title: "Confirmar e-mail — RharouWallet",
};

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm">
        <VerifyEmailClient />
      </div>
    </main>
  );
}
