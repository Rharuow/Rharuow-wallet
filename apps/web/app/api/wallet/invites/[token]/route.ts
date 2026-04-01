import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { API_BASE, buildApiHeaders } from "@/lib/api";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { token: inviteId } = await params;
  const res = await fetch(`${API_BASE}/v1/wallet/invites/${inviteId}`, {
    method: "DELETE",
    headers: buildApiHeaders({ token }),
  });

  if (res.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}