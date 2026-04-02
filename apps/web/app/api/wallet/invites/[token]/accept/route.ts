import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const routeParams = await params;

  try {
    const data = await apiFetch(`/v1/wallet/invites/${routeParams.token}/accept`, {
      method: "POST",
      body: JSON.stringify({}),
      token,
    });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      (err as { message?: string }).message ?? "Erro ao aceitar convite";
    return NextResponse.json({ error: message }, { status });
  }
}