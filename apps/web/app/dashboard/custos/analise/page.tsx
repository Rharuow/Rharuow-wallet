import { getAuthToken } from "@/lib/auth";
import { AnalysisShell } from "./AnalysisShell";

export const metadata = { title: "Análise de Custos — RharouWallet" };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function fetchAreas(token: string | null) {
  if (!token) return [];
  const res = await fetch(`${API_URL}/v1/costs/areas`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.areas ?? []) as { id: string; name: string }[];
}

async function fetchTypes(token: string | null) {
  if (!token) return [];
  const res = await fetch(`${API_URL}/v1/costs/types`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.types ?? []) as { id: string; name: string; areaId: string }[];
}

export default async function AnalisePage() {
  const token = await getAuthToken();
  const [areas, types] = await Promise.all([fetchAreas(token), fetchTypes(token)]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          Análise de Custos
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Visualize seus custos domésticos por período, área e tipo.
        </p>
      </div>
      <AnalysisShell areas={areas} types={types} />
    </div>
  );
}
