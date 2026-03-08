"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Select, Switch } from "rharuow-ds";
import { CheckIcon, XIcon } from "@/components/icons";
import { toInputDate } from "./types";
import { useCostLists } from "./hooks/useCostLists";
import type { CostArea } from "./areas/AreasTable";
import type { CostType } from "./types";

interface Props {
  areas: CostArea[];
  types: CostType[];
}

export function CostCreateCard({ areas, types }: Props) {
  const router = useRouter();
  const lists = useCostLists({ initialAreas: areas, initialTypes: types });

  const [areaId, setAreaId] = useState("");
  const [costTypeId, setCostTypeId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(toInputDate(new Date().toISOString()));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // recurrence
  const [isRecurring, setIsRecurring] = useState(false);
  const [unit, setUnit] = useState("MONTH");
  const [interval, setInterval] = useState("1");
  const [maxOccurrences, setMaxOccurrences] = useState("");

  const filteredTypes = areaId
    ? lists.localTypes.filter((t) => t.areaId === areaId)
    : lists.localTypes;
  const areaOptions = lists.localAreas.map((a) => ({ label: a.name, value: a.id }));
  const typeOptions = filteredTypes.map((t) => ({ label: t.name, value: t.id }));

  async function handleSubmit() {
    if (!costTypeId || !amount || !date) return;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Informe um valor válido.");
      return;
    }
    if (isRecurring) {
      const parsedInterval = parseInt(interval, 10);
      if (isNaN(parsedInterval) || parsedInterval < 1) {
        setError("Informe um intervalo válido.");
        return;
      }
    }
    setCreating(true);
    setError(null);
    try {
      let res: Response;
      if (isRecurring) {
        res = await fetch("/api/costs/recurrences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            costTypeId,
            amount: parsedAmount,
            description: description.trim() || undefined,
            unit,
            interval: parseInt(interval, 10),
            startDate: new Date(date).toISOString(),
            ...(maxOccurrences ? { maxOccurrences: parseInt(maxOccurrences, 10) } : {}),
          }),
        });
      } else {
        res = await fetch("/api/costs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            costTypeId,
            amount: parsedAmount,
            description: description.trim() || undefined,
            date: new Date(date).toISOString(),
          }),
        });
      }
      if (res.ok) {
        setCostTypeId("");
        setAmount("");
        setDescription("");
        setDate(toInputDate(new Date().toISOString()));
        setIsRecurring(false);
        setUnit("MONTH");
        setInterval("1");
        setMaxOccurrences("");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erro ao registrar custo.");
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card className="p-4">
      <p className="mb-3 text-sm font-medium text-[var(--foreground)]">Novo custo</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Área */}
        <div>
          <Select
            name="newAreaFilter"
            label="Área (filtro)"
            isClearable
            value={areaId}
            onChange={(e) => {
              setAreaId(e.target.value);
              setCostTypeId("");
            }}
            options={areaOptions}
          />
          {lists.showCreateArea !== "new" ? (
            <Button
              variant="outline"
              size="xs"
              className="mt-1"
              onClick={() => {
                lists.setShowCreateArea("new");
                lists.setInlineAreaName("");
                lists.setCreateAreaError(null);
              }}
            >
              Nova área
            </Button>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <Input
                name="inlineAreaName"
                label="Nome da área"
                value={lists.inlineAreaName}
                onChange={(e) => {
                  lists.setInlineAreaName(e.target.value);
                  lists.setCreateAreaError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") lists.submitInlineArea("new", (id) => { setAreaId(id); setCostTypeId(""); });
                  if (e.key === "Escape") lists.setShowCreateArea(null);
                }}
                containerClassName="mb-0 flex-1"
                autoFocus
              />
              <Button
                variant="icon"
                onClick={() => lists.submitInlineArea("new", (id) => { setAreaId(id); setCostTypeId(""); })}
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
          {lists.createAreaError && lists.showCreateArea === "new" && (
            <p className="text-xs text-red-500">{lists.createAreaError}</p>
          )}
        </div>

        {/* Tipo */}
        <div>
          <Select
            name="newCostTypeId"
            label="Tipo de custo"
            value={costTypeId}
            onChange={(e) => setCostTypeId(e.target.value)}
            options={typeOptions}
          />
          {lists.showCreateType !== "new" ? (
            <Button
              variant="outline"
              size="xs"
              className="mt-1"
              onClick={() => {
                lists.setShowCreateType("new");
                lists.setInlineTypeName("");
                lists.setCreateTypeError(null);
              }}
              disabled={!areaId}
              title={!areaId ? "Selecione uma área primeiro" : undefined}
            >
              Novo tipo
            </Button>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <Input
                name="inlineTypeName"
                label="Nome do tipo"
                value={lists.inlineTypeName}
                onChange={(e) => {
                  lists.setInlineTypeName(e.target.value);
                  lists.setCreateTypeError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") lists.submitInlineType("new", areaId, (id) => setCostTypeId(id));
                  if (e.key === "Escape") lists.setShowCreateType(null);
                }}
                containerClassName="mb-0 flex-1"
                autoFocus
              />
              <Button
                variant="icon"
                onClick={() => lists.submitInlineType("new", areaId, (id) => setCostTypeId(id))}
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
          {lists.createTypeError && lists.showCreateType === "new" && (
            <p className="text-xs text-red-500">{lists.createTypeError}</p>
          )}
        </div>

        <Input
          name="newAmount"
          label="Valor (R$)"
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setError(null); }}
          containerClassName="mb-0"
        />
        <Input
          name="newDate"
          label={isRecurring ? "Data de início" : "Data"}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          containerClassName="mb-0"
        />
        <Input
          name="newDescription"
          label="Descrição (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          containerClassName="mb-0 sm:col-span-1 lg:col-span-1"
        />
        <div className="flex items-end">
          <Button
            onClick={handleSubmit}
            disabled={creating || !costTypeId || !amount || !date}
            className="w-full"
          >
            {creating ? "Adicionando…" : "Adicionar"}
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <Switch
          checked={isRecurring}
          onChange={setIsRecurring}
          label="Custo recorrente"
          labelPosition="right"
        />
      </div>

      {isRecurring && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Select
            name="newUnit"
            label="Unidade de repetição"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            options={[
              { label: "Dia", value: "DAY" },
              { label: "Semana", value: "WEEK" },
              { label: "Mês", value: "MONTH" },
              { label: "Ano", value: "YEAR" },
            ]}
          />
          <Input
            name="newInterval"
            label="Intervalo (a cada N)"
            type="number"
            min="1"
            step="1"
            value={interval}
            onChange={(e) => { setInterval(e.target.value); setError(null); }}
            containerClassName="mb-0"
          />
          <Input
            name="newMaxOccurrences"
            label="Máx. ocorrências (opcional)"
            type="number"
            min="1"
            step="1"
            value={maxOccurrences}
            onChange={(e) => setMaxOccurrences(e.target.value)}
            containerClassName="mb-0"
          />
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </Card>
  );
}
