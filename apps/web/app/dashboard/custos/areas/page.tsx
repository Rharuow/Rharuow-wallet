import { getAuthToken } from "@/lib/auth";
import { AreasTable, CostArea } from "./AreasTable";

export const metadata = { title: "Áreas de Custo — RharouWallet" };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function fetchAreas(token: string | null): Promise<CostArea[]> {
  if (!token) return [];
  const res = await fetch(`${API_URL}/v1/costs/areas`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.areas ?? [];
}

export default async function AreasPage() {
  const token = await getAuthToken();
  const areas = await fetchAreas(token);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          Áreas de Custo
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Áreas padrão do sistema e suas áreas personalizadas.
        </p>
      </div>
      <AreasTable areas={areas} />
    </div>
  );
}
