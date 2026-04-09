import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token ausente" }, { status: 400 });
  }

  try {
    const data = await apiFetch<{ message: string }>(
      `/v1/auth/verify-email?token=${encodeURIComponent(token)}`
    );
    return NextResponse.json(data);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      (err as { message?: string }).message ?? "Erro ao verificar e-mail";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const data = await apiFetch<{ message: string }>("/v1/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message =
      (err as { message?: string }).message ?? "Erro ao reenviar e-mail";
    return NextResponse.json({ error: message }, { status });
  }
}
