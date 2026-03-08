"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Cost, CostRecurrence } from "../types";
import { toInputDate } from "../types";

interface UseCostEditOptions {
  recurrences: CostRecurrence[];
  localTypes: { id: string; areaId: string }[];
}

export function useCostEdit({ recurrences, localTypes }: UseCostEditOptions) {
  const router = useRouter();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAreaId, setEditAreaId] = useState("");
  const [editCostTypeId, setEditCostTypeId] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // recurrence edit
  const [editRecurrenceId, setEditRecurrenceId] = useState<string | null>(null);
  const [editUnit, setEditUnit] = useState("MONTH");
  const [editInterval, setEditInterval] = useState("1");
  const [editMaxOccurrences, setEditMaxOccurrences] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  function startEdit(cost: Cost) {
    setEditError(null);
    const matchedType = localTypes.find((t) => t.id === cost.costTypeId);
    setEditingId(cost.id);
    setEditAreaId(matchedType?.areaId ?? "");
    setEditCostTypeId(cost.costTypeId);
    setEditAmount(String(cost.amount));
    setEditDescription(cost.description ?? "");
    setEditDate(toInputDate(cost.date));
    if (cost.recurrenceId) {
      const rec = recurrences.find((r) => r.id === cost.recurrenceId);
      setEditRecurrenceId(cost.recurrenceId);
      setEditUnit(rec?.unit ?? "MONTH");
      setEditInterval(String(rec?.interval ?? 1));
      setEditMaxOccurrences(rec?.maxOccurrences != null ? String(rec.maxOccurrences) : "");
      setEditIsActive(rec?.isActive ?? true);
    } else {
      setEditRecurrenceId(null);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditAreaId("");
    setEditCostTypeId("");
    setEditAmount("");
    setEditDescription("");
    setEditDate("");
    setEditError(null);
    setEditRecurrenceId(null);
  }

  async function submitEdit() {
    if (!editingId || !editCostTypeId || !editAmount || !editDate) return;
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      setEditError("Informe um valor válido.");
      return;
    }
    if (editRecurrenceId) {
      const interval = parseInt(editInterval, 10);
      if (isNaN(interval) || interval < 1) {
        setEditError("Informe um intervalo válido.");
        return;
      }
    }
    setSaving(true);
    setEditError(null);
    try {
      const costRes = await fetch(`/api/costs/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          costTypeId: editCostTypeId,
          amount,
          description: editDescription.trim() || undefined,
          date: new Date(editDate).toISOString(),
        }),
      });
      if (!costRes.ok) {
        const data = await costRes.json().catch(() => ({}));
        setEditError(data.error ?? "Erro ao atualizar custo.");
        return;
      }
      if (editRecurrenceId) {
        const recRes = await fetch(`/api/costs/recurrences/${editRecurrenceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            description: editDescription.trim() || undefined,
            unit: editUnit,
            interval: parseInt(editInterval, 10),
            maxOccurrences: editMaxOccurrences ? parseInt(editMaxOccurrences, 10) : null,
            isActive: editIsActive,
          }),
        });
        if (!recRes.ok) {
          const data = await recRes.json().catch(() => ({}));
          setEditError(data.error ?? "Erro ao atualizar recorrência.");
          return;
        }
      }
      cancelEdit();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return {
    editingId,
    editAreaId,
    setEditAreaId,
    editCostTypeId,
    setEditCostTypeId,
    editAmount,
    setEditAmount,
    editDescription,
    setEditDescription,
    editDate,
    setEditDate,
    saving,
    editError,
    setEditError,
    editRecurrenceId,
    editUnit,
    setEditUnit,
    editInterval,
    setEditInterval,
    editMaxOccurrences,
    setEditMaxOccurrences,
    editIsActive,
    setEditIsActive,
    startEdit,
    cancelEdit,
    submitEdit,
  };
}
