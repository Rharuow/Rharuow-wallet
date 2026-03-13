const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type HistoryPoint = { date: string; value: number };

export type MarketAsset = {
  code: string;
  name: string;
  symbol: string;
  value: number;
  change: number;
  history: HistoryPoint[];
};

export async function fetchMarketAssets(): Promise<MarketAsset[]> {
  try {
    const res = await fetch(`${API_BASE}/v1/market`, {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    const data: { assets: MarketAsset[] } = await res.json();
    return data.assets ?? [];
  } catch {
    return [];
  }
}
