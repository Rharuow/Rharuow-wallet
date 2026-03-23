"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Select, Switch } from "rharuow-ds";
import { CheckIcon, XIcon } from "@/components/icons";
import { toInputDate } from "./types";
import { useCostLists } from "./hooks/useCostLists";
import type { CostArea } from "./areas/AreasTable";
import type { CostType } from "./types";

interface SmartSuggestion {
  amount: number;
  areaId: string;
  areaName: string;
  costTypeId: string | null;
  costTypeName: string;
  description: string;
}

interface Props {
  areas: CostArea[];
  types: CostType[];
  isPremium?: boolean;
}

export function CostCreateCard({ areas, types, isPremium = false }: Props) {
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

  // Smart Add (AI)
  const [smartName, setSmartName] = useState("");
  const [smartAmount, setSmartAmount] = useState("");
  const [loadingSmart, setLoadingSmart] = useState(false);
  const [smartSuggestion, setSmartSuggestion] = useState<SmartSuggestion | null>(null);
  const [smartError, setSmartError] = useState<string | null>(null);
  const [confirmingSmart, setConfirmingSmart] = useState(false);

  const filteredTypes = areaId
    ? lists.localTypes.filter((t) => t.areaId === areaId)
    : lists.localTypes;
  const areaOptions = lists.localAreas.map((a) => ({ label: a.name, value: a.id }));
  const typeOptions = filteredTypes.map((t) => ({ label: t.name, value: t.id }));

  async function handleSmartAnalyze() {
    if (!smartName.trim() || !smartAmount.trim() || loadingSmart) return;
    setLoadingSmart(true);
    setSmartSuggestion(null);
    setSmartError(null);
    try {
      const res = await fetch("/api/ai/cost-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: `${smartName.trim()} ${smartAmount.trim()}`,
          areas: lists.localAreas.map((a) => ({ id: a.id, name: a.name })),
          types: lists.localTypes.map((t) => ({ id: t.id, name: t.name, areaId: t.areaId })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSmartError(data.error ?? "Erro ao analisar.");
      } else {
        setSmartSuggestion(data.suggestion ?? null);
      }
    } catch {
      setSmartError("Erro ao analisar. Tente novamente.");
    } finally {
      setLoadingSmart(false);
    }
  }

  async function handleSmartConfirm() {
    if (!smartSuggestion) return;
    setConfirmingSmart(true);
    setSmartError(null);
    try {
      let resolvedTypeId = smartSuggestion.costTypeId;
      if (!resolvedTypeId) {
        const typeRes = await fetch("/api/costs/types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: smartSuggestion.costTypeName,
            areaId: smartSuggestion.areaId,
          }),
        });
        if (!typeRes.ok) {
          const d = await typeRes.json().catch(() => ({}));
          setSmartError(d.error ?? "Erro ao criar tipo de custo.");
          return;
        }
        const typeData = await typeRes.json();
        resolvedTypeId = typeData.type?.id ?? null;
        if (!resolvedTypeId) {
          setSmartError("Erro ao obter o tipo de custo criado.");
          return;
        }
      }
      const costRes = await fetch("/api/costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          costTypeId: resolvedTypeId,
          amount: smartSuggestion.amount,
          description: smartSuggestion.description,
          date: new Date().toISOString(),
        }),
      });
      if (costRes.ok) {
        setSmartName("");
        setSmartAmount("");
        setSmartSuggestion(null);
        router.refresh();
      } else {
        const d = await costRes.json().catch(() => ({}));
        setSmartError(d.error ?? "Erro ao registrar custo.");
      }
    } finally {
      setConfirmingSmart(false);
    }
  }

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
      {/* Smart Add — Premium only */}
      {isPremium && (
        <div className="mb-5">
          <p className="mb-1.5 text-xs font-semibold text-[var(--primary)]">✨ Adicionar com IA</p>
          <div className="flex flex-col md:flex-row gap-2">
            <Input
              name="smartName"
              label="Nome do custo (ex: Restaurante, Netflix)"
              value={smartName}
              onChange={(e) => {
                setSmartName(e.target.value);
                setSmartSuggestion(null);
                setSmartError(null);
              }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSmartAnalyze(); }}
              containerClassName="mb-0 flex-1"
            />
            <Input
              name="smartAmount"
              label="Valor (R$)"
              type="number"
              min="0.01"
              step="0.01"
              value={smartAmount}
              onChange={(e) => {
                setSmartAmount(e.target.value);
                setSmartSuggestion(null);
                setSmartError(null);
              }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSmartAnalyze(); }}
              containerClassName="mb-0 w-36"
            />
            <Button
              onClick={handleSmartAnalyze}
              disabled={loadingSmart || !smartName.trim() || !smartAmount.trim()}
              className="self-end whitespace-nowrap"
            >
              {loadingSmart ? "Analisando…" : "Analisar"}
            </Button>
          </div>

          {smartError && <p className="mt-1 text-xs text-red-500">{smartError}</p>}

          {smartSuggestion && !loadingSmart && (
            <div className="mt-3 rounded-lg border border-[var(--primary)] bg-[var(--primary)]/5 p-4">
              <p className="mb-2 text-xs font-semibold text-[var(--primary)]">Categorização sugerida</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                <dt className="text-slate-500">Valor</dt>
                <dd className="font-medium">
                  {smartSuggestion.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </dd>
                <dt className="text-slate-500">Área</dt>
                <dd className="font-medium">{smartSuggestion.areaName}</dd>
                <dt className="text-slate-500">Tipo</dt>
                <dd className="font-medium">
                  {smartSuggestion.costTypeName}
                  {!smartSuggestion.costTypeId && (
                    <span className="ml-1 rounded bg-[var(--primary)]/10 px-1 py-0.5 text-[10px] text-[var(--primary)]">
                      novo
                    </span>
                  )}
                </dd>
                <dt className="text-slate-500">Descrição</dt>
                <dd className="font-medium">{smartSuggestion.description}</dd>
              </dl>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={handleSmartConfirm} disabled={confirmingSmart}>
                  {confirmingSmart ? "Registrando…" : "Confirmar e Registrar"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setSmartSuggestion(null); setSmartName(""); setSmartAmount(""); }}
                  disabled={confirmingSmart}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            <span className="text-xs text-slate-400">ou adicione manualmente</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
      )}
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

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

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
    </Card>
  );
}
