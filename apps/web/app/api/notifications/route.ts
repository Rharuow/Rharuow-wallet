import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

export async function GET(req: NextRequest) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const queryString = req.nextUrl.searchParams.toString();

  try {
    const data = await apiFetch(`/v1/notifications${queryString ? `?${queryString}` : ""}`, {
      token,
      cache: "no-store",
    });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      (err as { message?: string }).message ?? "Erro ao listar notificações";
    return NextResponse.json({ error: message }, { status });
  }
}