import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicRoutes = ["/login", "/register", "/forgot-password"];

export function middleware(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  const { pathname } = request.nextUrl;

  const isPublic = publicRoutes.some((r) => pathname.startsWith(r));

  if (!token && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (token && isPublic) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|logo.png|api/).*)",
  ],
};
