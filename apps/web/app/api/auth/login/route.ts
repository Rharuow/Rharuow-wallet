import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";

type LoginResponse = {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: { id: string; name: string };
  };
};

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const data = await apiFetch<LoginResponse>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const response = NextResponse.json({ user: data.user });

    response.cookies.set("auth_token", data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 dias
      path: "/",
    });

    return response;
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const rawMessage =
      (err as { message?: string }).message ?? "Erro ao realizar login";
    const message =
      status === 403
        ? "Conta não confirmada. Verifique seu e-mail."
        : rawMessage;

    return NextResponse.json({ error: message }, { status });
  }
}
