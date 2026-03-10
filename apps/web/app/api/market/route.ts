import { NextResponse } from "next/server";
import { fetchMarketAssets } from "@/lib/market";

export async function GET() {
  const assets = await fetchMarketAssets();
  return NextResponse.json({ assets });
}
