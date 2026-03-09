"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Select } from "rharuow-ds";

type Area = { id: string; name: string };

interface Props {
  areas: Area[];
}

export function TypeCreateCard({ areas }: Props) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const areaOptions = areas.map((a) => ({ label: a.name, value: a.id }));

  async function handleCreate() {
    if (!name.trim() || !areaId) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/costs/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), areaId }),
      });
      if (res.ok) {
        setName("");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erro ao criar tipo.");
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card className="p-4">
      <p className="mb-3 text-sm font-medium text-[var(--foreground)]">Novo tipo</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Input
          name="newTypeName"
          label="Nome do tipo"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          containerClassName="flex-1 mb-0"
        />
        <Select
          name="newTypeArea"
          label="Área"
          value={areaId}
          onChange={(e) => setAreaId(e.target.value)}
          options={areaOptions}
          containerClassName="flex-1 mb-0"
        />
        <Button
          onClick={handleCreate}
          disabled={creating || !name.trim() || !areaId}
        >
          {creating ? "Adicionando…" : "Adicionar"}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </Card>
  );
}
