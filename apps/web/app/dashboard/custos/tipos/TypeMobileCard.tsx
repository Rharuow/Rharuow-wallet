"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Select } from "rharuow-ds";
import { PencilIcon, TrashIcon, CheckIcon, XIcon } from "@/components/icons";
import { CostType } from "../types";

type Area = { id: string; name: string };

interface Props {
  type: CostType;
  areas: Area[];
  onDeleteRequest: (type: CostType) => void;
}

export function TypeMobileCard({ type, areas, onDeleteRequest }: Props) {
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAreaId, setEditAreaId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const areaOptions = areas.map((a) => ({ label: a.name, value: a.id }));

  function startEdit() {
    setEditName(type.name);
    setEditAreaId(type.area.id);
    setError(null);
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
    setEditName("");
    setEditAreaId("");
    setError(null);
  }

  async function submitEdit() {
    if (!editName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/costs/types/${type.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), areaId: editAreaId }),
      });
      if (res.ok) {
        cancelEdit();
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erro ao atualizar tipo.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (isEditing) {
    return (
      <Card className="p-4 flex flex-col gap-3">
        <Input
          name="editTypeName"
          label="Nome do tipo"
          value={editName}
          onChange={(e) => { setEditName(e.target.value); setError(null); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitEdit();
            if (e.key === "Escape") cancelEdit();
          }}
          containerClassName="mb-0"
          autoFocus
        />
        <Select
          name="editTypeArea"
          label="Área"
          value={editAreaId}
          onChange={(e) => setEditAreaId(e.target.value)}
          options={areaOptions}
          containerClassName="mb-0"
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2">
          <Button
            onClick={submitEdit}
            disabled={saving || !editName.trim()}
            className="flex-1"
          >
            {saving ? "Salvando…" : "Confirmar"}
          </Button>
          <Button variant="outline" onClick={cancelEdit} className="flex-1">
            Cancelar
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-base font-semibold text-[var(--foreground)]">
            {type.name}
          </span>
          <span className="text-sm text-slate-500">{type.area.name}</span>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="icon" onClick={startEdit} title="Editar tipo">
            <PencilIcon />
          </Button>
          <Button
            variant="icon"
            onClick={() => onDeleteRequest(type)}
            title="Remover tipo"
          >
            <TrashIcon />
          </Button>
        </div>
      </div>
    </Card>
  );
}
