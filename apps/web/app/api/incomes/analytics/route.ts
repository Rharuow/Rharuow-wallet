import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function token() {
  const store = await cookies();
  return store.get("auth_token")?.value ?? "";
}

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  const res = await fetch(
    `${API_BASE}/v1/incomes/analytics${qs ? `?${qs}` : ""}`,
    {
      headers: { Authorization: `Bearer ${await token()}` },
      cache: "no-store",
    }
  );
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
