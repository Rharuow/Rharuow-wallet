import { apiFetch } from "@/lib/api";
import { getAuthToken, getAuthUser } from "@/lib/auth";
import { InviteTokenClient } from "./InviteTokenClient";

type WalletInvite = {
  id: string;
  token: string;
  guestEmail: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED";
  expiresAt: string;
  createdAt: string;
  owner?: { id: string; email: string; name: string | null };
};

async function fetchInviteForCurrentUser(token: string, authToken: string | null) {
  if (!authToken) return null as WalletInvite | null;

  try {
    const data = await apiFetch<{ invites: WalletInvite[] }>(
      "/v1/wallet/invites/received",
      {
        token: authToken,
        cache: "no-store",
      }
    );

    return data.invites.find((invite) => invite.token === token) ?? null;
  } catch {
    return null;
  }
}

export default async function InviteTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [authToken, user] = await Promise.all([getAuthToken(), getAuthUser()]);
  const invite = await fetchInviteForCurrentUser(token, authToken);

  return <InviteTokenClient token={token} user={user} invite={invite} />;
}