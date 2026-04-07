"use client";

import { Fragment } from "react";
import { Table, Button, Input, Select, Switch } from "rharuow-ds";
import { PencilIcon, TrashIcon, CheckIcon, XIcon } from "@/components/icons";
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

export function CostTableRow({ cost, localAreas, localTypes, edit, lists, onDeleteRequest, canWrite = true }: Props) {
  const isEditing = edit.editingId === cost.id;

  const costType = localTypes.find((t) => t.id === cost.costTypeId);
  const area = localAreas.find((a) => a.id === cost.costType.areaId);

  const editFilteredTypes = edit.editAreaId
    ? localTypes.filter((t) => t.areaId === edit.editAreaId)
    : localTypes;
  const areaOptions = localAreas.map((a) => ({ label: a.name, value: a.id }));
  const editTypeOptions = editFilteredTypes.map((t) => ({ label: t.name, value: t.id }));

  return (
    <Fragment>
      <Table.Row>
        {isEditing ? (
          <>
            {/* Data */}
            <Table.Cell>
              <Input
                name="editDate"
                type="date"
                value={edit.editDate}
                onChange={(e) => edit.setEditDate(e.target.value)}
                containerClassName="mb-0"
              />
            </Table.Cell>

            {/* Área */}
            <Table.Cell>
              <Select
                name="editAreaFilter"
                label=""
                isClearable
                value={edit.editAreaId}
                onChange={(e) => {
                  edit.setEditAreaId(e.target.value);
                  edit.setEditCostTypeId("");
                }}
                options={areaOptions}
              />
              {lists.showCreateArea !== "edit" ? (
                <Button
                  variant="outline"
                  size="xs"
                  className="mt-1"
                  onClick={() => {
                    lists.setShowCreateArea("edit");
                    lists.setInlineAreaName("");
                    lists.setCreateAreaError(null);
                  }}
                >
                  Nova área
                </Button>
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    name="inlineAreaNameEdit"
                    label="Nome da área"
                    value={lists.inlineAreaName}
                    onChange={(e) => {
                      lists.setInlineAreaName(e.target.value);
                      lists.setCreateAreaError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        lists.submitInlineArea("edit", (id) => {
                          edit.setEditAreaId(id);
                          edit.setEditCostTypeId("");
                        });
                      if (e.key === "Escape") lists.setShowCreateArea(null);
                    }}
                    containerClassName="mb-0 flex-1"
                    autoFocus
                  />
                  <Button
                    variant="icon"
                    onClick={() =>
                      lists.submitInlineArea("edit", (id) => {
                        edit.setEditAreaId(id);
                        edit.setEditCostTypeId("");
                      })
                    }
                    disabled={lists.creatingArea || !lists.inlineAreaName.trim()}
                    title="Criar área"
                  >
                    <CheckIcon />
                  </Button>
                  <Button variant="icon" onClick={() => lists.setShowCreateArea(null)} title="Cancelar">
                    <XIcon />
                  </Button>
                </div>
              )}
              {lists.createAreaError && lists.showCreateArea === "edit" && (
                <p className="text-xs text-red-500">{lists.createAreaError}</p>
              )}
            </Table.Cell>

            {/* Tipo */}
            <Table.Cell>
              <Select
                name="editCostTypeId"
                label=""
                value={edit.editCostTypeId}
                onChange={(e) => edit.setEditCostTypeId(e.target.value)}
                options={editTypeOptions}
              />
              {lists.showCreateType !== "edit" ? (
                <Button
                  variant="outline"
                  size="xs"
                  className="mt-1"
                  onClick={() => {
                    lists.setShowCreateType("edit");
                    lists.setInlineTypeName("");
                    lists.setCreateTypeError(null);
                  }}
                  disabled={!edit.editAreaId}
                  title={!edit.editAreaId ? "Selecione uma área primeiro" : undefined}
                >
                  Novo tipo
                </Button>
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    name="inlineTypeNameEdit"
                    label="Nome do tipo"
                    value={lists.inlineTypeName}
                    onChange={(e) => {
                      lists.setInlineTypeName(e.target.value);
                      lists.setCreateTypeError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        lists.submitInlineType("edit", edit.editAreaId, (id) =>
                          edit.setEditCostTypeId(id)
                        );
                      if (e.key === "Escape") lists.setShowCreateType(null);
                    }}
                    containerClassName="mb-0 flex-1"
                    autoFocus
                  />
                  <Button
                    variant="icon"
                    onClick={() =>
                      lists.submitInlineType("edit", edit.editAreaId, (id) =>
                        edit.setEditCostTypeId(id)
                      )
                    }
                    disabled={lists.creatingType || !lists.inlineTypeName.trim()}
                    title="Criar tipo"
                  >
                    <CheckIcon />
                  </Button>
                  <Button variant="icon" onClick={() => lists.setShowCreateType(null)} title="Cancelar">
                    <XIcon />
                  </Button>
                </div>
              )}
              {lists.createTypeError && lists.showCreateType === "edit" && (
                <p className="text-xs text-red-500">{lists.createTypeError}</p>
              )}
            </Table.Cell>

            {/* Valor */}
            <Table.Cell>
              <Input
                name="editAmount"
                type="number"
                min="0.01"
                step="0.01"
                value={edit.editAmount}
                onChange={(e) => { edit.setEditAmount(e.target.value); edit.setEditError(null); }}
                containerClassName="mb-0"
              />
            </Table.Cell>

            {/* Descrição */}
            <Table.Cell>
              <div className="flex flex-col gap-1">
                <Input
                  name="editDescription"
                  value={edit.editDescription}
                  onChange={(e) => edit.setEditDescription(e.target.value)}
                  containerClassName="mb-0"
                />
                <div className="pt-1">
                  <Switch
                    checked={edit.editIsRecurring}
                    onChange={edit.setEditIsRecurring}
                    label="Recorrente"
                    labelPosition="right"
                  />
                </div>
                {edit.editError && (
                  <span className="text-xs text-red-500">{edit.editError}</span>
                )}
              </div>
            </Table.Cell>

            {/* Ações */}
            <Table.Cell align="center">
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="icon"
                  onClick={edit.submitEdit}
                  disabled={edit.saving || !edit.editCostTypeId || !edit.editAmount || !edit.editDate}
                  title="Confirmar edição"
                >
                  <CheckIcon />
                </Button>
                <Button variant="icon" onClick={edit.cancelEdit} title="Cancelar edição">
                  <XIcon />
                </Button>
              </div>
            </Table.Cell>
          </>
        ) : (
          <>
            <Table.Cell className="whitespace-nowrap text-sm">
              {displayDate(cost.date)}
            </Table.Cell>
            <Table.Cell className="text-sm">
              {area?.name ?? costType?.area?.name ?? "—"}
            </Table.Cell>
            <Table.Cell className="text-sm">
              <span>{cost.costType.name}</span>
              {cost.recurrenceId && (
                <span className="ml-1 text-xs text-blue-500" title="Custo recorrente">↻</span>
              )}
            </Table.Cell>
            <Table.Cell className="whitespace-nowrap text-sm font-medium">
              {formatBRL(Number(cost.amount))}
            </Table.Cell>
            <Table.Cell className="text-sm text-slate-500">
              {cost.description ?? "—"}
            </Table.Cell>
            <Table.Cell align="center">
              {canWrite ? (
                <div className="flex items-center justify-center gap-2">
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
            </Table.Cell>
          </>
        )}
      </Table.Row>

      {isEditing && edit.editIsRecurring && (
        <Table.Row>
          <Table.Cell colSpan={6} className="bg-slate-50 dark:bg-slate-900/50 px-4 pb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Recorrência
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Select
                name="editUnit"
                label="Unidade"
                value={edit.editUnit}
                onChange={(e) => edit.setEditUnit(e.target.value)}
                options={Object.entries(UNIT_LABEL).map(([v, l]) => ({ label: l, value: v }))}
              />
              <Input
                name="editInterval"
                label="Intervalo (a cada N)"
                type="number"
                min="1"
                step="1"
                value={edit.editInterval}
                onChange={(e) => { edit.setEditInterval(e.target.value); edit.setEditError(null); }}
                containerClassName="mb-0"
              />
              <Input
                name="editMaxOccurrences"
                label="Máx. ocorrências (opcional)"
                type="number"
                min="1"
                step="1"
                value={edit.editMaxOccurrences}
                onChange={(e) => edit.setEditMaxOccurrences(e.target.value)}
                containerClassName="mb-0"
              />
              <div className="flex items-end pb-2">
                <Switch
                  checked={edit.editIsActive}
                  onChange={edit.setEditIsActive}
                  label="Ativa"
                  labelPosition="right"
                />
              </div>
            </div>
          </Table.Cell>
        </Table.Row>
      )}
    </Fragment>
  );
}
