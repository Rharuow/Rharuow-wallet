import { NextRequest, NextResponse } from "next/server";

function clearAuthCookie(response: NextResponse) {
  response.cookies.set("auth_token", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
}

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearAuthCookie(response);
  return response;
}

/** GET /api/auth/logout — limpa o cookie e redireciona para /login.
 *  Usado pelo DashboardLayout para forçar logout quando o token é inválido. */
export async function GET(req: NextRequest) {
  const loginUrl = new URL("/login", req.nextUrl.origin);
  const response = NextResponse.redirect(loginUrl);
  clearAuthCookie(response);
  return response;
}
