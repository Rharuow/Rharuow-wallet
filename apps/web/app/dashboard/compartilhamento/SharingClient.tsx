"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, useToast } from "rharuow-ds";
import type { SharedWalletAccess, WalletContext } from "@/lib/wallet";

type InviteStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED";

type WalletInvite = {
  id: string;
  token: string;
  guestEmail: string;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
  owner?: { id: string; email: string; name: string | null };
  guest?: { id: string; email: string; name: string | null } | null;
  access?: { id: string; permission: "READ" | "FULL"; createdAt: string } | null;
};

type OwnedAccess = {
  id: string;
  permission: "READ" | "FULL";
  guest: { id: string; email: string; name: string | null };
  invite: { id: string; guestEmail: string; status: InviteStatus; createdAt: string } | null;
};

function formatDate(value: string) {
  const date = new Date(value);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear()).slice(-2);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function statusLabel(status: InviteStatus) {
  switch (status) {
    case "PENDING":
      return "Pendente";
    case "ACCEPTED":
      return "Aceito";
    case "DECLINED":
      return "Recusado";
    case "REVOKED":
      return "Revogado";
    default:
      return status;
  }
}

export function SharingClient({
  walletContext,
  sentInvites,
  receivedInvites,
  ownedAccesses,
  sharedWithMe,
}: {
  walletContext: WalletContext | null;
  sentInvites: WalletInvite[];
  receivedInvites: WalletInvite[];
  ownedAccesses: OwnedAccess[];
  sharedWithMe: SharedWalletAccess[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [guestEmail, setGuestEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const pendingReceivedInvites = useMemo(
    () => receivedInvites.filter((invite) => invite.status === "PENDING"),
    [receivedInvites]
  );

  async function sendInvite() {
    if (!guestEmail.trim()) return;

    setSending(true);
    try {
      const response = await fetch("/api/wallet/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestEmail: guestEmail.trim() }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data.error ?? "Erro ao enviar convite");
        return;
      }

      setGuestEmail("");
      toast.success("Convite enviado com sucesso");
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  async function revokeInvite(inviteId: string) {
    setActingId(inviteId);
    try {
      const response = await fetch(`/api/wallet/invites/${inviteId}`, {
        method: "DELETE",
      });

      if (!response.ok && response.status !== 204) {
        const data = await response.json().catch(() => ({}));
        toast.error(data.error ?? "Erro ao revogar convite");
        return;
      }

      toast.success("Acesso revogado");
      router.refresh();
    } finally {
      setActingId(null);
    }
  }

  async function respondToInvite(token: string, action: "accept" | "decline") {
    setActingId(token);
    try {
      const response = await fetch(`/api/wallet/invites/${token}/${action}`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data.error ?? "Erro ao processar convite");
        return;
      }

      toast.success(action === "accept" ? "Convite aceito" : "Convite recusado");
      router.refresh();
    } finally {
      setActingId(null);
    }
  }

  async function activateWallet(ownerId: string | null) {
    const response = await fetch("/api/wallet/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId }),
    });

    if (!response.ok) {
      toast.error("Erro ao trocar carteira ativa");
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          Compartilhamento de Carteira
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Envie convites, aceite acessos recebidos e alterne entre carteiras compartilhadas.
        </p>
      </div>

      <Card className="p-5">
        <p className="mb-3 text-sm font-semibold text-[var(--foreground)]">
          Convidar usuário
        </p>
        <div className="flex flex-col gap-3 md:flex-row">
          <Input
            name="guestEmail"
            label="E-mail do convidado"
            type="email"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            containerClassName="mb-0 flex-1"
          />
          <Button onClick={sendInvite} disabled={sending || !guestEmail.trim()}>
            {sending ? "Enviando..." : "Enviar convite"}
          </Button>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <p className="mb-4 text-sm font-semibold text-[var(--foreground)]">
            Convites recebidos
          </p>
          <div className="flex flex-col gap-3">
            {pendingReceivedInvites.length === 0 && (
              <p className="text-sm text-slate-500">
                Nenhum convite pendente no momento.
              </p>
            )}

            {pendingReceivedInvites.map((invite) => (
              <div
                key={invite.id}
                className="rounded-xl border border-slate-200 px-4 py-3"
              >
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {invite.owner?.name ?? invite.owner?.email ?? "Convite recebido"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Enviado em {formatDate(invite.createdAt)} para {invite.guestEmail}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => respondToInvite(invite.token, "accept")}
                    disabled={actingId === invite.token}
                  >
                    Aceitar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => respondToInvite(invite.token, "decline")}
                    disabled={actingId === invite.token}
                  >
                    Recusar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <p className="mb-4 text-sm font-semibold text-[var(--foreground)]">
            Compartilhadas comigo
          </p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                !walletContext?.isShared
                  ? "border-[var(--primary)] bg-[var(--primary)]/5"
                  : "border-slate-200"
              }`}
              onClick={() => activateWallet(null)}
            >
              <p className="text-sm font-medium text-[var(--foreground)]">
                Minha carteira
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Voltar ao contexto principal do seu usuário.
              </p>
            </button>

            {sharedWithMe.length === 0 && (
              <p className="text-sm text-slate-500">
                Nenhuma carteira compartilhada com você ainda.
              </p>
            )}

            {sharedWithMe.map((access) => (
              <button
                key={access.id}
                type="button"
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  walletContext?.activeWallet.ownerId === access.owner.id &&
                  walletContext.isShared
                    ? "border-[var(--primary)] bg-[var(--primary)]/5"
                    : "border-slate-200"
                }`}
                onClick={() => activateWallet(access.owner.id)}
              >
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {access.owner.name ?? access.owner.email}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Permissão: {access.permission === "FULL" ? "edição" : "somente leitura"}
                </p>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <p className="mb-4 text-sm font-semibold text-[var(--foreground)]">
          Convites enviados
        </p>
        <div className="flex flex-col gap-3">
          {sentInvites.length === 0 && (
            <p className="text-sm text-slate-500">Nenhum convite enviado ainda.</p>
          )}

          {sentInvites.map((invite) => (
            <div
              key={invite.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {invite.guest?.name ?? invite.guestEmail}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {statusLabel(invite.status)} · criado em {formatDate(invite.createdAt)}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => revokeInvite(invite.id)}
                disabled={actingId === invite.id || invite.status === "REVOKED"}
              >
                Revogar
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <p className="mb-4 text-sm font-semibold text-[var(--foreground)]">
          Acessos ativos concedidos
        </p>
        <div className="flex flex-col gap-3">
          {ownedAccesses.length === 0 && (
            <p className="text-sm text-slate-500">Nenhum acesso ativo concedido.</p>
          )}

          {ownedAccesses.map((access) => (
            <div
              key={access.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {access.guest.name ?? access.guest.email}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Permissão: {access.permission === "FULL" ? "edição" : "somente leitura"}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => access.invite && revokeInvite(access.invite.id)}
                disabled={actingId === access.invite?.id || !access.invite}
              >
                Revogar acesso
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}