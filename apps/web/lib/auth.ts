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
