"use client";

import { Card, Button, Input, Select, Switch } from "rharuow-ds";
import { PencilIcon, TrashIcon } from "@/components/icons";
import { formatBRL } from "@/lib/format";
import { displayDate, UNIT_LABEL } from "./types";
import type { Cost, CostType } from "./types";
import type { CostArea } from "./areas/AreasTable";
import type { useCostEdit } from "./hooks/useCostEdit";
import type { useCostLists } from "./hooks/useCostLists";

type EditBag = ReturnType<typeof useCostEdit>;
type ListsBag = ReturnType<typeof useCostLists>;

interface Props {
  cost: Cost;
  localAreas: CostArea[];
  localTypes: CostType[];
  edit: EditBag;
  lists: ListsBag;
  onDeleteRequest: (cost: Cost) => void;
  canWrite?: boolean;
}

export function CostMobileCard({ cost, localAreas, localTypes, edit, lists: _lists, onDeleteRequest, canWrite = true }: Props) {
  void _lists;
  const isEditing = edit.editingId === cost.id;

  const costType = localTypes.find((t) => t.id === cost.costTypeId);
  const area = localAreas.find((a) => a.id === cost.costType.areaId);

  const editFilteredTypes = edit.editAreaId
    ? localTypes.filter((t) => t.areaId === edit.editAreaId)
    : localTypes;
  const areaOptions = localAreas.map((a) => ({ label: a.name, value: a.id }));

  if (isEditing) {
    return (
      <Card className="p-4 flex flex-col gap-3">
        <Input
          name="editDate"
          label="Data"
          type="date"
          value={edit.editDate}
          onChange={(e) => edit.setEditDate(e.target.value)}
          containerClassName="mb-0"
        />
        <Select
          name="editAreaFilterM"
          label="Área"
          isClearable
          value={edit.editAreaId}
          onChange={(e) => { edit.setEditAreaId(e.target.value); edit.setEditCostTypeId(""); }}
          options={areaOptions}
        />
        <Select
          name="editCostTypeIdM"
          label="Tipo"
          value={edit.editCostTypeId}
          onChange={(e) => edit.setEditCostTypeId(e.target.value)}
          options={editFilteredTypes.map((t) => ({ label: t.name, value: t.id }))}
        />
        <Input
          name="editAmountM"
          label="Valor (R$)"
          type="number"
          min="0.01"
          step="0.01"
          value={edit.editAmount}
          onChange={(e) => { edit.setEditAmount(e.target.value); edit.setEditError(null); }}
          containerClassName="mb-0"
        />
        <Input
          name="editDescriptionM"
          label="Descrição"
          value={edit.editDescription}
          onChange={(e) => edit.setEditDescription(e.target.value)}
          containerClassName="mb-0"
        />

        <Switch
          checked={edit.editIsRecurring}
          onChange={edit.setEditIsRecurring}
          label="Custo recorrente"
          labelPosition="right"
        />

        {edit.editIsRecurring && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recorrência</p>
            <Select
              name="editUnitM"
              label="Unidade"
              value={edit.editUnit}
              onChange={(e) => edit.setEditUnit(e.target.value)}
              options={Object.entries(UNIT_LABEL).map(([v, l]) => ({ label: l, value: v }))}
            />
            <Input
              name="editIntervalM"
              label="Intervalo (a cada N)"
              type="number"
              min="1"
              step="1"
              value={edit.editInterval}
              onChange={(e) => { edit.setEditInterval(e.target.value); edit.setEditError(null); }}
              containerClassName="mb-0"
            />
            <Input
              name="editMaxOccurrencesM"
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
              labelPosition="right"
            />
          </>
        )}

        {edit.editError && <p className="text-xs text-red-500">{edit.editError}</p>}
        <div className="flex gap-2">
          <Button
            onClick={edit.submitEdit}
            disabled={edit.saving || !edit.editCostTypeId || !edit.editAmount || !edit.editDate}
            className="flex-1"
          >
            {edit.saving ? "Salvando…" : "Confirmar"}
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
            {formatBRL(Number(cost.amount))}
          </span>
          <span className="text-sm">
            {cost.costType.name}
            {(area?.name ?? costType?.area?.name) ? (
              <strong className="ml-1">
                · {area?.name ?? costType?.area?.name}
              </strong>
            ) : null}
          </span>
          {cost.description && (
            <span className="text-xs text-slate-400">{cost.description}</span>
          )}
          <span className="text-xs text-slate-400">
            {displayDate(cost.date)}
            {cost.recurrenceId && (
              <span className="ml-1 text-blue-400" title="Recorrente">↻</span>
            )}
          </span>
        </div>
        {canWrite ? (
          <div className="flex shrink-0 gap-1">
            <Button variant="icon" onClick={() => edit.startEdit(cost)} title="Editar custo">
              <PencilIcon />
            </Button>
            <Button variant="icon" onClick={() => onDeleteRequest(cost)} title="Remover custo">
              <TrashIcon />
            </Button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Somente leitura</span>
        )}
      </div>
    </Card>
  );
}
