import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const data = await apiFetch<{ message: string }>("/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = (err as { message?: string }).message ?? "Erro ao processar solicitação";
    return NextResponse.json({ error: message }, { status });
  }
}
