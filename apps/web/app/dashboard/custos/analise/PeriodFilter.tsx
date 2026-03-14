"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Card, Select, Input } from "rharuow-ds";

export type Filters = {
  dateFrom: string;
  dateTo: string;
  areaId: string;
  costTypeId: string;
};

type Area = { id: string; name: string };
type CostType = { id: string; name: string; areaId: string };

interface Props {
  areas: Area[];
  types: CostType[];
  onChange: (filters: Filters) => void;
}

const PRESETS = [
  { label: "Este mês", value: "this_month" },
  { label: "Mês anterior", value: "last_month" },
  { label: "Últimos 3 meses", value: "last_3" },
  { label: "Últimos 6 meses", value: "last_6" },
  { label: "Este ano", value: "this_year" },
  { label: "Personalizado", value: "custom" },
];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function presetToDates(preset: string): { dateFrom: string; dateTo: string } | null {
  const now = new Date();
  const ms = (y: number, m: number) => new Date(y, m, 1);
  const me = (y: number, m: number) => new Date(y, m + 1, 0);
  switch (preset) {
    case "this_month":
      return { dateFrom: isoDate(ms(now.getFullYear(), now.getMonth())), dateTo: isoDate(me(now.getFullYear(), now.getMonth())) };
    case "last_month": {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { dateFrom: isoDate(ms(d.getFullYear(), d.getMonth())), dateTo: isoDate(me(d.getFullYear(), d.getMonth())) };
    }
    case "last_3": {
      const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return { dateFrom: isoDate(ms(d.getFullYear(), d.getMonth())), dateTo: isoDate(me(now.getFullYear(), now.getMonth())) };
    }
    case "last_6": {
      const d = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      return { dateFrom: isoDate(ms(d.getFullYear(), d.getMonth())), dateTo: isoDate(me(now.getFullYear(), now.getMonth())) };
    }
    case "this_year":
      return { dateFrom: isoDate(new Date(now.getFullYear(), 0, 1)), dateTo: isoDate(new Date(now.getFullYear(), 11, 31)) };
    default:
      return null;
  }
}

export function AnalyticsFilter({ areas, types, onChange }: Props) {
  const [preset, setPreset] = useState("this_month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [areaId, setAreaId] = useState("");
  const [costTypeId, setCostTypeId] = useState("");

  const filteredTypes = areaId ? types.filter((t) => t.areaId === areaId) : types;

  const areaOptions = [
    { label: "Todas as áreas", value: "" },
    ...areas.map((a) => ({ label: a.name, value: a.id })),
  ];

  const typeOptions = [
    { label: "Todos os tipos", value: "" },
    ...filteredTypes.map((t) => ({ label: t.name, value: t.id })),
  ];

  const applyFilters = useCallback(
    (overrides?: Partial<{ from: string; to: string; areaId: string; costTypeId: string }>) => {
      const f = overrides?.from ?? from;
      const t = overrides?.to ?? to;
      const a = overrides?.areaId !== undefined ? overrides.areaId : areaId;
      const ct = overrides?.costTypeId !== undefined ? overrides.costTypeId : costTypeId;
      if (f && t) onChange({ dateFrom: f, dateTo: t, areaId: a, costTypeId: ct });
    },
    [from, to, areaId, costTypeId, onChange]
  );

  useEffect(() => {
    const dates = presetToDates("this_month")!;
    setFrom(dates.dateFrom);
    setTo(dates.dateTo);
    onChange({ dateFrom: dates.dateFrom, dateTo: dates.dateTo, areaId: "", costTypeId: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePreset(value: string) {
    setPreset(value);
    if (value !== "custom") {
      const dates = presetToDates(value);
      if (dates) {
        setFrom(dates.dateFrom);
        setTo(dates.dateTo);
        onChange({ dateFrom: dates.dateFrom, dateTo: dates.dateTo, areaId, costTypeId });
      }
    }
  }

  function handleFromChange(value: string) {
    setFrom(value);
    setPreset("custom");
  }

  function handleToChange(value: string) {
    setTo(value);
    setPreset("custom");
  }

  function handleArea(value: string) {
    setAreaId(value);
    setCostTypeId("");
    applyFilters({ areaId: value, costTypeId: "" });
  }

  function handleType(value: string) {
    setCostTypeId(value);
    applyFilters({ costTypeId: value });
  }

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="w-full sm:w-48">
          <Select
            name="periodPreset"
            label="Período"
            value={preset}
            onChange={(e) => handlePreset(e.target.value)}
            options={PRESETS}
          />
        </div>

        <div className="w-full sm:w-40">
          <Input
            name="dateFrom"
            label="De"
            type="date"
            value={from}
            onChange={(e) => handleFromChange(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-40">
          <Input
            name="dateTo"
            label="Até"
            type="date"
            value={to}
            onChange={(e) => handleToChange(e.target.value)}
          />
        </div>

        {preset === "custom" && (
          <Button
            onClick={() => applyFilters()}
            disabled={!from || !to}
            className="sm:self-end"
          >
            Aplicar
          </Button>
        )}

        <div className="w-full sm:w-48">
          <Select
            name="filterArea"
            value={areaId}
            onChange={(e) => handleArea(e.target.value)}
            options={areaOptions}
          />
        </div>

        <div className="w-full sm:w-48">
          <Select
            name="filterType"
            value={costTypeId}
            onChange={(e) => handleType(e.target.value)}
            options={typeOptions}
          />
        </div>
      </div>
    </Card>
  );
}
