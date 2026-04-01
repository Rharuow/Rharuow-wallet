import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { buildApiHeaders } from "@/lib/api";
import { getRawActiveWalletOwnerId } from "@/lib/wallet";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function token() {
  const store = await cookies();
  return store.get("auth_token")?.value ?? "";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const walletOwnerId = await getRawActiveWalletOwnerId();
  const body = await req.json();
  const res = await fetch(`${API_BASE}/v1/costs/${id}`, {
    method: "PATCH",
    headers: buildApiHeaders({ token: await token(), walletOwnerId }),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const walletOwnerId = await getRawActiveWalletOwnerId();
  const res = await fetch(`${API_BASE}/v1/costs/${id}`, {
    method: "DELETE",
    headers: buildApiHeaders({ token: await token(), walletOwnerId }),
  });
  if (res.status === 204) return new NextResponse(null, { status: 204 });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
