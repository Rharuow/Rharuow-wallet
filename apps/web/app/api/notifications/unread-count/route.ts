import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

export async function GET() {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const data = await apiFetch("/v1/notifications/unread-count", {
      token,
      cache: "no-store",
    });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      (err as { message?: string }).message ?? "Erro ao contar notificações";
    return NextResponse.json({ error: message }, { status });
  }
}