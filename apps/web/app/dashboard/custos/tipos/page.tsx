import { getAuthToken } from "@/lib/auth";
import { TypesTable } from "./TypesTable";
import { CostType } from "../types";

export const metadata = { title: "Tipos de Custo — RharouWallet" };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function fetchTypes(token: string | null): Promise<CostType[]> {
  if (!token) return [];
  const res = await fetch(`${API_URL}/v1/costs/types`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.types ?? [];
}

async function fetchAreas(token: string | null): Promise<{ id: string; name: string }[]> {
  if (!token) return [];
  const res = await fetch(`${API_URL}/v1/costs/areas`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.areas ?? [];
}

export default async function TiposPage() {
  const token = await getAuthToken();
  const [types, areas] = await Promise.all([fetchTypes(token), fetchAreas(token)]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          Tipos de Custo
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Tipos de custo associados às áreas cadastradas.
        </p>
      </div>
      <TypesTable types={types} areas={areas} />
    </div>
  );
}
