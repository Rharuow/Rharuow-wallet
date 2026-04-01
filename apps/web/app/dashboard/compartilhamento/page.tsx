import { apiFetch } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { getWalletContext, type SharedWalletAccess } from "@/lib/wallet";
import { SharingClient } from "./SharingClient";

export const metadata = { title: "Compartilhamento — RharouWallet" };

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

async function fetchSentInvites(token: string | null) {
  if (!token) return [] as WalletInvite[];
  const data = await apiFetch<{ invites: WalletInvite[] }>("/v1/wallet/invites", {
    token,
    cache: "no-store",
  });
  return data.invites ?? [];
}

async function fetchReceivedInvites(token: string | null) {
  if (!token) return [] as WalletInvite[];
  const data = await apiFetch<{ invites: WalletInvite[] }>(
    "/v1/wallet/invites/received",
    {
      token,
      cache: "no-store",
    }
  );
  return data.invites ?? [];
}

async function fetchOwnedAccesses(token: string | null) {
  if (!token) return [] as OwnedAccess[];
  const data = await apiFetch<{ accesses: OwnedAccess[] }>("/v1/wallet/accesses", {
    token,
    cache: "no-store",
  });
  return data.accesses ?? [];
}

export default async function CompartilhamentoPage() {
  const token = await getAuthToken();
  const [walletContext, sentInvites, receivedInvites, ownedAccesses] =
    await Promise.all([
      getWalletContext(),
      fetchSentInvites(token),
      fetchReceivedInvites(token),
      fetchOwnedAccesses(token),
    ]);

  return (
    <SharingClient
      walletContext={walletContext}
      sentInvites={sentInvites}
      receivedInvites={receivedInvites}
      ownedAccesses={ownedAccesses}
      sharedWithMe={walletContext?.sharedWallets ?? ([] as SharedWalletAccess[])}
    />
  );
}