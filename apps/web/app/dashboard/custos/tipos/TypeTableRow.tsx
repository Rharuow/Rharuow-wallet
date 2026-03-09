"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Table, Button, Input, Select } from "rharuow-ds";
import { PencilIcon, TrashIcon, CheckIcon, XIcon } from "@/components/icons";
import { CostType } from "../types";

type Area = { id: string; name: string };

interface Props {
  type: CostType;
  areas: Area[];
  onDeleteRequest: (type: CostType) => void;
}

export function TypeTableRow({ type, areas, onDeleteRequest }: Props) {
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAreaId, setEditAreaId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const areaOptions = areas.map((a) => ({ label: a.name, value: a.id }));

  function startEdit() {
    setError(null);
    setEditName(type.name);
    setEditAreaId(type.area.id);
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

  return (
    <Table.Row>
      {/* Nome */}
      <Table.Cell>
        {isEditing ? (
          <div className="flex flex-col gap-1">
            <Input
              name="editTypeName"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") submitEdit();
                if (e.key === "Escape") cancelEdit();
              }}
              containerClassName="mb-0"
            />
            {error && <span className="text-xs text-red-500">{error}</span>}
          </div>
        ) : (
          <span className="text-sm">{type.name}</span>
        )}
      </Table.Cell>

      {/* Área */}
      <Table.Cell>
        {isEditing ? (
          <Select
            name="editTypeArea"
            value={editAreaId}
            onChange={(e) => setEditAreaId(e.target.value)}
            options={areaOptions}
            containerClassName="mb-0"
          />
        ) : (
          <span className="text-sm text-slate-500">{type.area.name}</span>
        )}
      </Table.Cell>

      {/* Ações */}
      <Table.Cell align="center">
        {isEditing ? (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="icon"
              onClick={submitEdit}
              disabled={saving || !editName.trim()}
              title="Confirmar edição"
            >
              <CheckIcon />
            </Button>
            <Button variant="icon" onClick={cancelEdit} title="Cancelar edição">
              <XIcon />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
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
        )}
      </Table.Cell>
    </Table.Row>
  );
}
