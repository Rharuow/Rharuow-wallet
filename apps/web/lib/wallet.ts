import { cookies } from "next/headers";
import { apiFetch, buildApiHeaders } from "./api";
import { getAuthToken, getAuthUser, type AuthUser } from "./auth";

export const ACTIVE_WALLET_COOKIE = "active_wallet_owner_id";

export type WalletPermission = "READ" | "FULL";

export type SharedWalletAccess = {
  id: string;
  permission: WalletPermission;
  owner: {
    id: string;
    email: string;
    name: string | null;
  };
  invite: {
    id: string;
    guestEmail: string;
    status: string;
    createdAt: string;
  } | null;
};

export type WalletContext = {
  user: AuthUser;
  sharedWallets: SharedWalletAccess[];
  activeWallet: {
    ownerId: string;
    ownerEmail: string;
    ownerName: string;
    mode: "own" | "shared";
    permission: WalletPermission;
  };
  canWrite: boolean;
  isShared: boolean;
};

export async function getRawActiveWalletOwnerId() {
  const store = await cookies();
  return store.get(ACTIVE_WALLET_COOKIE)?.value ?? null;
}

export async function getWalletContext(): Promise<WalletContext | null> {
  const [token, user, selectedOwnerId] = await Promise.all([
    getAuthToken(),
    getAuthUser(),
    getRawActiveWalletOwnerId(),
  ]);

  if (!token || !user) {
    return null;
  }

  let sharedWallets: SharedWalletAccess[] = [];

  try {
    const data = await apiFetch<{ accesses: SharedWalletAccess[] }>(
      "/v1/wallet/accesses/shared-with-me",
      {
        token,
        cache: "no-store",
      }
    );
    sharedWallets = data.accesses ?? [];
  } catch {
    sharedWallets = [];
  }

  const selectedSharedWallet =
    sharedWallets.find((access) => access.owner.id === selectedOwnerId) ?? null;

  if (selectedSharedWallet) {
    return {
      user,
      sharedWallets,
      activeWallet: {
        ownerId: selectedSharedWallet.owner.id,
        ownerEmail: selectedSharedWallet.owner.email,
        ownerName:
          selectedSharedWallet.owner.name ?? selectedSharedWallet.owner.email,
        mode: "shared",
        permission: selectedSharedWallet.permission,
      },
      canWrite: selectedSharedWallet.permission === "FULL",
      isShared: true,
    };
  }

  return {
    user,
    sharedWallets,
    activeWallet: {
      ownerId: user.id,
      ownerEmail: user.email,
      ownerName: user.name,
      mode: "own",
      permission: "FULL",
    },
    canWrite: true,
    isShared: false,
  };
}

export async function getWalletAwareHeaders(token: string | null) {
  const walletContext = await getWalletContext();
  const walletOwnerId = walletContext?.isShared
    ? walletContext.activeWallet.ownerId
    : null;

  return buildApiHeaders({ token, walletOwnerId });
}