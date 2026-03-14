import { cookies } from "next/headers";
import { apiFetch } from "./api";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: { id: string; name: string };
};

export async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("auth_token")?.value ?? null;
}

export async function getPlan(
  token: string
): Promise<"FREE" | "PREMIUM"> {
  try {
    const API_BASE =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const res = await fetch(`${API_BASE}/v1/payments/status`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return "FREE";
    const data = await res.json();
    return data.plan ?? "FREE";
  } catch {
    return "FREE";
  }
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const token = await getAuthToken();
  if (!token) return null;

  try {
    const data = await apiFetch<{ user: AuthUser }>("/v1/users/me", { token });
    return data.user;
  } catch {
    return null;
  }
}
