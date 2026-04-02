import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

export async function POST(req: NextRequest) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json();

  try {
    const data = await apiFetch("/v1/wallet/invites", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    });
    return NextResponse.json(data, { status: 201 });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      (err as { message?: string }).message ?? "Erro ao enviar convite";
    return NextResponse.json({ error: message }, { status });
  }
}