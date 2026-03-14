"use client";

import { Card, Button, Input, Select, Switch } from "rharuow-ds";
import { PencilIcon, TrashIcon, CheckIcon, XIcon } from "@/components/icons";
import { displayDate, formatBRL, UNIT_LABEL } from "./types";
import type { Income, IncomeRecurrence } from "./types";
import type { useIncomeEdit } from "./hooks/useIncomeEdit";

type EditBag = ReturnType<typeof useIncomeEdit>;

interface Props {
  income: Income;
  recurrences: IncomeRecurrence[];
  edit: EditBag;
  onDeleteRequest: (income: Income) => void;
}

const UNIT_OPTIONS = Object.entries(UNIT_LABEL).map(([v, l]) => ({
  label: l,
  value: v,
}));

export function IncomeMobileCard({
  income,
  recurrences,
  edit,
  onDeleteRequest,
}: Props) {
  const isEditing = edit.editingId === income.id;
  const recurrence = recurrences.find((r) => r.id === income.recurrenceId);

  if (isEditing) {
    return (
      <Card className="p-4 flex flex-col gap-3">
        <Input
          name="editIncomeName"
          label="Nome"
          value={edit.editName}
          onChange={(e) => edit.setEditName(e.target.value)}
          containerClassName="mb-0"
        />
        <Input
          name="editIncomeAmount"
          label="Valor (R$)"
          type="number"
          min="0.01"
          step="0.01"
          value={edit.editAmount}
          onChange={(e) => edit.setEditAmount(e.target.value)}
          containerClassName="mb-0"
        />
        <Input
          name="editIncomeDate"
          label="Data"
          type="date"
          value={edit.editDate}
          onChange={(e) => edit.setEditDate(e.target.value)}
          containerClassName="mb-0"
        />
        <Input
          name="editIncomeDescription"
          label="Descrição"
          value={edit.editDescription}
          onChange={(e) => edit.setEditDescription(e.target.value)}
          containerClassName="mb-0"
        />

        {recurrence && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Recorrência
            </p>
            <Select
              name="editIncomeUnitM"
              label="Frequência"
              value={edit.editUnit}
              onChange={(e) => edit.setEditUnit(e.target.value)}
              options={UNIT_OPTIONS}
            />
            <Input
              name="editIncomeIntervalM"
              label="A cada (quantidade)"
              type="number"
              min="1"
              step="1"
              value={edit.editInterval}
              onChange={(e) => edit.setEditInterval(e.target.value)}
              containerClassName="mb-0"
            />
            <Input
              name="editIncomeMaxM"
              label="Máx. ocorrências (opcional)"
              type="number"
              min="1"
              step="1"
              value={edit.editMaxOccurrences}
              onChange={(e) => edit.setEditMaxOccurrences(e.target.value)}
              containerClassName="mb-0"
            />
            <Switch
              checked={edit.editIsActive}
              onChange={edit.setEditIsActive}
              label="Recorrência ativa"
            />
          </>
        )}

        {edit.error && <p className="text-xs text-red-500">{edit.error}</p>}
        <div className="flex gap-2">
          <Button
            onClick={() => edit.submitEdit(income, recurrence)}
            disabled={edit.submitting || !edit.editName.trim() || !edit.editAmount || !edit.editDate}
            className="flex-1"
          >
            {edit.submitting ? "Salvando…" : "Confirmar"}
          </Button>
          <Button variant="outline" onClick={edit.cancelEdit} className="flex-1">
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
            {formatBRL(Number(income.amount))}
          </span>
          <span className="text-sm text-slate-700">{income.name}</span>
          {income.description && (
            <span className="text-xs text-slate-500">{income.description}</span>
          )}
          <span className="text-xs text-slate-400">{displayDate(income.date)}</span>
          {recurrence && (
            <span className="text-xs text-[var(--primary)]">
              A cada {recurrence.interval}{" "}
              {UNIT_LABEL[recurrence.unit].toLowerCase()}
              {recurrence.isActive ? "" : " · pausada"}
            </span>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <Button
            variant="icon"
            onClick={() => edit.startEdit(income)}
            title="Editar"
          >
            <PencilIcon />
          </Button>
          <Button
            variant="icon"
            onClick={() => onDeleteRequest(income)}
            title="Remover"
          >
            <TrashIcon />
          </Button>
        </div>
      </div>
    </Card>
  );
}
