const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.message ?? "API error") as Error & {
      status: number;
      body: unknown;
    };
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return res.json() as Promise<T>;
}
