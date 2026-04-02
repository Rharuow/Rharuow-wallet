"use client";

import { Button, Input, Select, Switch, Table } from "rharuow-ds";
import { PencilIcon, TrashIcon } from "@/components/icons";
import { displayDate, formatBRL, UNIT_LABEL } from "./types";
import type { Income, IncomeRecurrence } from "./types";
import type { useIncomeEdit } from "./hooks/useIncomeEdit";

type EditBag = ReturnType<typeof useIncomeEdit>;

interface Props {
  income: Income;
  recurrences: IncomeRecurrence[];
  edit: EditBag;
  onDeleteRequest: (income: Income) => void;
  canWrite?: boolean;
}

const UNIT_OPTIONS = Object.entries(UNIT_LABEL).map(([v, l]) => ({
  label: l,
  value: v,
}));

export function IncomeTableRow({
  income,
  recurrences,
  edit,
  onDeleteRequest,
  canWrite = true,
}: Props) {
  const isEditing = edit.editingId === income.id;
  const recurrence = recurrences.find((r) => r.id === income.recurrenceId);

  if (isEditing) {
    return (
      <Table.Row>
        <Table.Cell className="whitespace-nowrap">
          <Input
            name="editIncomeDate"
            label=""
            type="date"
            value={edit.editDate}
            onChange={(e) => edit.setEditDate(e.target.value)}
            containerClassName="mb-0"
          />
        </Table.Cell>
        <Table.Cell>
          <Input
            name="editIncomeName"
            label=""
            value={edit.editName}
            onChange={(e) => edit.setEditName(e.target.value)}
            containerClassName="mb-0"
          />
        </Table.Cell>
        <Table.Cell>
          <Input
            name="editIncomeAmount"
            label=""
            type="number"
            min="0.01"
            step="0.01"
            value={edit.editAmount}
            onChange={(e) => edit.setEditAmount(e.target.value)}
            containerClassName="mb-0"
          />
        </Table.Cell>
        <Table.Cell className="w-full">
          <Input
            name="editIncomeDescription"
            label=""
            value={edit.editDescription}
            onChange={(e) => edit.setEditDescription(e.target.value)}
            containerClassName="mb-0"
          />
        </Table.Cell>
        {recurrence ? (
          <Table.Cell>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Select
                  name="editIncomeUnit"
                  label=""
                  value={edit.editUnit}
                  onChange={(e) => edit.setEditUnit(e.target.value)}
                  options={UNIT_OPTIONS}
                />
                <Input
                  name="editIncomeInterval"
                  label=""
                  type="number"
                  min="1"
                  step="1"
                  value={edit.editInterval}
                  onChange={(e) => edit.setEditInterval(e.target.value)}
                  containerClassName="mb-0 w-20"
                />
              </div>
              <Switch
                checked={edit.editIsActive}
                onChange={edit.setEditIsActive}
                label="Ativa"
              />
            </div>
          </Table.Cell>
        ) : (
          <Table.Cell>—</Table.Cell>
        )}
        <Table.Cell align="center">
          {edit.error && (
            <p className="mb-1 text-xs text-red-500">{edit.error}</p>
          )}
          <div className="flex gap-1 justify-center">
            <Button
              size="xs"
              onClick={() => edit.submitEdit(income, recurrence)}
              disabled={
                edit.submitting ||
                !edit.editName.trim() ||
                !edit.editAmount ||
                !edit.editDate
              }
            >
              {edit.submitting ? "…" : "Salvar"}
            </Button>
            <Button size="xs" variant="outline" onClick={edit.cancelEdit}>
              Cancelar
            </Button>
          </div>
        </Table.Cell>
      </Table.Row>
    );
  }

  return (
    <Table.Row>
      <Table.Cell className="whitespace-nowrap">{displayDate(income.date)}</Table.Cell>
      <Table.Cell>{income.name}</Table.Cell>
      <Table.Cell className="whitespace-nowrap">
        {formatBRL(Number(income.amount))}
      </Table.Cell>
      <Table.Cell className="w-full text-slate-600">
        {income.description ?? "—"}
      </Table.Cell>
      <Table.Cell className="whitespace-nowrap">
        {recurrence ? (
          <span
            className={`text-xs ${recurrence.isActive ? "text-[var(--primary)]" : "text-slate-400"}`}
          >
            A cada {recurrence.interval}{" "}
            {UNIT_LABEL[recurrence.unit].toLowerCase()}
            {!recurrence.isActive && " · pausada"}
          </span>
        ) : (
          <span className="text-xs text-slate-400">Avulso</span>
        )}
      </Table.Cell>
      <Table.Cell align="center">
        {canWrite ? (
          <div className="flex gap-1 justify-center">
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
        ) : (
          <span className="text-xs text-slate-400">Somente leitura</span>
        )}
      </Table.Cell>
    </Table.Row>
  );
}
