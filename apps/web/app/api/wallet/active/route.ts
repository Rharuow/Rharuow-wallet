import { NextRequest, NextResponse } from "next/server";
import { ACTIVE_WALLET_COOKIE } from "@/lib/wallet";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    ownerId?: string | null;
  };

  const response = NextResponse.json({ ok: true });

  if (!body.ownerId) {
    response.cookies.set(ACTIVE_WALLET_COOKIE, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
    });
    return response;
  }

  response.cookies.set(ACTIVE_WALLET_COOKIE, body.ownerId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACTIVE_WALLET_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
  return response;
}