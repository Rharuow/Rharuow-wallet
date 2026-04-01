export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function buildApiHeaders(options: {
  token?: string | null;
  walletOwnerId?: string | null;
  headers?: HeadersInit;
} = {}) {
  const { token, walletOwnerId, headers } = options;

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(walletOwnerId ? { "X-Wallet-Owner": walletOwnerId } : {}),
    ...(headers ?? {}),
  };
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string; walletOwnerId?: string | null } = {}
): Promise<T> {
  const { token, walletOwnerId, headers, ...rest } = options;

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: buildApiHeaders({ token, walletOwnerId, headers }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.message ?? "API error") as Error & {
      status: number;
      body: unknown;
    };
    err.message = (body as { error?: string; message?: string }).error ?? (body as { error?: string; message?: string }).message ?? "API error";
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return res.json() as Promise<T>;
}
