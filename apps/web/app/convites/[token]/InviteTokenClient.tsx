"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, useToast } from "rharuow-ds";
import type { AuthUser } from "@/lib/auth";

type WalletInvite = {
  id: string;
  token: string;
  guestEmail: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED";
  expiresAt: string;
  createdAt: string;
  owner?: { id: string; email: string; name: string | null };
};

function statusMessage(status: WalletInvite["status"]) {
  switch (status) {
    case "ACCEPTED":
      return "Este convite já foi aceito.";
    case "DECLINED":
      return "Este convite já foi recusado.";
    case "REVOKED":
      return "Este convite foi revogado pelo dono da carteira.";
    default:
      return "Este convite está pendente.";
  }
}

export function InviteTokenClient({
  token,
  user,
  invite,
}: {
  token: string;
  user: AuthUser | null;
  invite: WalletInvite | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);

  async function handleAction(action: "accept" | "decline") {
    setLoading(action);
    try {
      const response = await fetch(`/api/wallet/invites/${token}/${action}`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data.error ?? "Erro ao processar convite");
        return;
      }

      if (action === "accept" && invite?.owner?.id) {
        await fetch("/api/wallet/active", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerId: invite.owner.id }),
        });
        router.push("/dashboard/custos");
        return;
      }

      router.push("/dashboard/compartilhamento");
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-8">
      <div className="w-full max-w-xl">
        <Card variant="elevated">
          <Card.Header>
            <h1 className="text-xl font-semibold text-[var(--foreground)]">
              Convite para carteira compartilhada
            </h1>
            <p className="text-sm">
              {invite?.owner?.name ?? invite?.owner?.email ?? "Você recebeu um convite para acessar uma carteira no RharouWallet."}
            </p>
          </Card.Header>

          <Card.Body>
            {!user ? (
              <div className="space-y-4">
                <p className="text-sm">
                  Faça login para aceitar ou recusar este convite. O sistema vai te devolver exatamente para esta tela.
                </p>
                <Link href={`/login?next=${encodeURIComponent(`/convites/${token}`)}`}>
                  <Button className="w-full">Entrar para continuar</Button>
                </Link>
              </div>
            ) : !invite ? (
              <div className="space-y-4">
                <p className="text-sm">
                  Nenhum convite pendente ou acessível foi encontrado para a conta {user.email}.
                </p>
                <Link href="/dashboard/compartilhamento">
                  <Button variant="outline" className="w-full">
                    Ir para compartilhamento
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
                  <p>
                    Conta conectada: <strong>{user.email}</strong>
                  </p>
                  <p className="mt-1">
                    Status do convite: <strong>{statusMessage(invite.status)}</strong>
                  </p>
                </div>

                {invite.status === "PENDING" ? (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      className="flex-1"
                      onClick={() => handleAction("accept")}
                      disabled={loading !== null}
                    >
                      {loading === "accept" ? "Aceitando..." : "Aceitar convite"}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleAction("decline")}
                      disabled={loading !== null}
                    >
                      {loading === "decline" ? "Recusando..." : "Recusar convite"}
                    </Button>
                  </div>
                ) : (
                  <Link href="/dashboard/compartilhamento">
                    <Button variant="outline" className="w-full">
                      Ir para compartilhamento
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </Card.Body>
        </Card>
      </div>
    </main>
  );
}