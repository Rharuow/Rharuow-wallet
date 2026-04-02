import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const routeParams = await params;

  try {
    const data = await apiFetch(`/v1/notifications/${routeParams.id}/read`, {
      method: "PATCH",
      body: JSON.stringify({}),
      token,
    });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      (err as { message?: string }).message ?? "Erro ao marcar notificação como lida";
    return NextResponse.json({ error: message }, { status });
  }
}