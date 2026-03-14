"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input, Select, Switch } from "rharuow-ds";
import { toInputDate } from "./types";

const UNIT_OPTIONS = [
  { label: "Dia", value: "DAY" },
  { label: "Semana", value: "WEEK" },
  { label: "Mês", value: "MONTH" },
  { label: "Ano", value: "YEAR" },
];

export function IncomeCreateCard() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(toInputDate(new Date().toISOString()));
  const [creating, setCreating] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // field-level errors
  const [nameError, setNameError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [intervalError, setIntervalError] = useState<string | null>(null);

  // recurrence
  const [isRecurring, setIsRecurring] = useState(false);
  const [unit, setUnit] = useState("MONTH");
  const [interval, setInterval] = useState("1");
  const [maxOccurrences, setMaxOccurrences] = useState("");

  function validate(): boolean {
    let valid = true;

    if (!name.trim()) {
      setNameError("Nome é obrigatório.");
      valid = false;
    } else {
      setNameError(null);
    }

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setAmountError("Informe um valor maior que zero.");
      valid = false;
    } else {
      setAmountError(null);
    }

    if (!date) {
      setDateError("Data é obrigatória.");
      valid = false;
    } else {
      setDateError(null);
    }

    if (isRecurring) {
      const parsedInterval = parseInt(interval, 10);
      if (isNaN(parsedInterval) || parsedInterval < 1) {
        setIntervalError("Intervalo deve ser no mínimo 1.");
        valid = false;
      } else {
        setIntervalError(null);
      }
    } else {
      setIntervalError(null);
    }

    return valid;
  }

  async function handleSubmit() {
    setServerError(null);
    if (!validate()) return;

    const parsedAmount = parseFloat(amount);
    setCreating(true);
    try {
      let res: Response;
      if (isRecurring) {
        res = await fetch("/api/incomes/recurrences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            amount: parsedAmount,
            unit,
            interval: parseInt(interval, 10),
            startDate: new Date(date).toISOString(),
            ...(maxOccurrences
              ? { maxOccurrences: parseInt(maxOccurrences, 10) }
              : {}),
          }),
        });
      } else {
        res = await fetch("/api/incomes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            amount: parsedAmount,
            date: new Date(date).toISOString(),
          }),
        });
      }

      if (res.ok) {
        setName("");
        setDescription("");
        setAmount("");
        setDate(toInputDate(new Date().toISOString()));
        setIsRecurring(false);
        setUnit("MONTH");
        setInterval("1");
        setMaxOccurrences("");
        setNameError(null);
        setAmountError(null);
        setDateError(null);
        setIntervalError(null);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setServerError(data.error ?? "Erro ao registrar entrada.");
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card className="p-4">
      <p className="mb-3 text-sm font-medium text-[var(--foreground)]">
        Nova entrada
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Nome */}
        <div>
          <Input
            name="incomeName"
            label="Nome *"
            placeholder="Ex: Salário, Freelance…"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError(null);
            }}
          />
          {nameError && (
            <p className="mt-0.5 text-xs text-red-500">{nameError}</p>
          )}
        </div>

        {/* Valor */}
        <div>
          <Input
            name="incomeAmount"
            label="Valor (R$) *"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              if (amountError) setAmountError(null);
            }}
          />
          {amountError && (
            <p className="mt-0.5 text-xs text-red-500">{amountError}</p>
          )}
        </div>

        {/* Data */}
        <div>
          <Input
            name="incomeDate"
            label={`${isRecurring ? "Início da recorrência" : "Data"} *`}
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              if (dateError) setDateError(null);
            }}
          />
          {dateError && (
            <p className="mt-0.5 text-xs text-red-500">{dateError}</p>
          )}
        </div>

        {/* Descrição */}
        <div className="sm:col-span-2 lg:col-span-3">
          <Input
            name="incomeDescription"
            label="Descrição (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Toggle recorrência */}
        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
          <Switch
            checked={isRecurring}
            onChange={(v) => {
              setIsRecurring(v);
              setIntervalError(null);
            }}
            label="Recorrente"
          />
        </div>

        {/* Campos de recorrência */}
        {isRecurring && (
          <>
            <Select
              name="incomeUnit"
              label="Frequência *"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              options={UNIT_OPTIONS}
            />
            <div>
              <Input
                name="incomeInterval"
                label="A cada (quantidade) *"
                type="number"
                min="1"
                step="1"
                value={interval}
                onChange={(e) => {
                  setInterval(e.target.value);
                  if (intervalError) setIntervalError(null);
                }}
              />
              {intervalError && (
                <p className="mt-0.5 text-xs text-red-500">{intervalError}</p>
              )}
            </div>
            <Input
              name="incomeMaxOccurrences"
              label="Máx. ocorrências (opcional)"
              type="number"
              min="1"
              step="1"
              value={maxOccurrences}
              onChange={(e) => setMaxOccurrences(e.target.value)}
            />
          </>
        )}
      </div>

      {serverError && (
        <p className="mt-2 text-xs text-red-500">{serverError}</p>
      )}

      <div className="mt-3 flex justify-end">
        <Button onClick={handleSubmit} disabled={creating}>
          {creating ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </Card>
  );
}
