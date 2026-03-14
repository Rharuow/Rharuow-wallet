"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Income, IncomeRecurrence } from "../types";

interface UseIncomeEditReturn {
  editingId: string | null;
  editName: string;
  editDescription: string;
  editAmount: string;
  editDate: string;
  editUnit: string;
  editInterval: string;
  editMaxOccurrences: string;
  editIsActive: boolean;
  submitting: boolean;
  error: string | null;
  setEditName: (v: string) => void;
  setEditDescription: (v: string) => void;
  setEditAmount: (v: string) => void;
  setEditDate: (v: string) => void;
  setEditUnit: (v: string) => void;
  setEditInterval: (v: string) => void;
  setEditMaxOccurrences: (v: string) => void;
  setEditIsActive: (v: boolean) => void;
  startEdit: (income: Income) => void;
  cancelEdit: () => void;
  submitEdit: (income: Income, recurrence: IncomeRecurrence | undefined) => Promise<void>;
}

export function useIncomeEdit(): UseIncomeEditReturn {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editUnit, setEditUnit] = useState("MONTH");
  const [editInterval, setEditInterval] = useState("1");
  const [editMaxOccurrences, setEditMaxOccurrences] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(income: Income) {
    setEditingId(income.id);
    setEditName(income.name);
    setEditDescription(income.description ?? "");
    setEditAmount(String(income.amount));
    setEditDate(income.date.slice(0, 10));
    if (income.recurrence) {
      setEditUnit(income.recurrence.unit);
      setEditInterval(String(income.recurrence.interval));
    } else {
      setEditUnit("MONTH");
      setEditInterval("1");
    }
    setEditMaxOccurrences("");
    setEditIsActive(true);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  async function submitEdit(income: Income, recurrence: IncomeRecurrence | undefined) {
    const parsedAmount = parseFloat(editAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Informe um valor válido.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/incomes/${income.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || undefined,
          amount: parsedAmount,
          date: new Date(editDate).toISOString(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erro ao atualizar.");
        return;
      }

      // Update recurrence if applicable
      if (recurrence) {
        const recRes = await fetch(`/api/incomes/recurrences/${recurrence.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editName.trim(),
            description: editDescription.trim() || undefined,
            amount: parsedAmount,
            unit: editUnit,
            interval: parseInt(editInterval, 10),
            ...(editMaxOccurrences
              ? { maxOccurrences: parseInt(editMaxOccurrences, 10) }
              : {}),
            isActive: editIsActive,
          }),
        });
        if (!recRes.ok) {
          const data = await recRes.json().catch(() => ({}));
          setError(data.error ?? "Erro ao atualizar recorrência.");
          return;
        }
      }

      setEditingId(null);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return {
    editingId,
    editName,
    editDescription,
    editAmount,
    editDate,
    editUnit,
    editInterval,
    editMaxOccurrences,
    editIsActive,
    submitting,
    error,
    setEditName,
    setEditDescription,
    setEditAmount,
    setEditDate,
    setEditUnit,
    setEditInterval,
    setEditMaxOccurrences,
    setEditIsActive,
    startEdit,
    cancelEdit,
    submitEdit,
  };
}
