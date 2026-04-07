import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

export async function GET() {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const data = await apiFetch<{ token: string; expiresInSeconds: number }>(
      "/v1/notifications/ws-token",
      {
        token,
        cache: "no-store",
      }
    );

    return NextResponse.json(data);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      (err as { message?: string }).message ?? "Erro ao preparar websocket de notificações";
    return NextResponse.json({ error: message }, { status });
  }
}