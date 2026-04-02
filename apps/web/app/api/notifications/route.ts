import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

export async function GET(req: NextRequest) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const page = searchParams.get("page") ?? "1";
  const limit = searchParams.get("limit") ?? "20";
  const unreadOnly = searchParams.get("unreadOnly") ?? "false";

  try {
    const data = await apiFetch(
      `/v1/notifications?page=${page}&limit=${limit}&unreadOnly=${unreadOnly}`,
      {
        token,
        cache: "no-store",
      }
    );
    return NextResponse.json(data);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      (err as { message?: string }).message ?? "Erro ao listar notificações";
    return NextResponse.json({ error: message }, { status });
  }
}