export type RecurrenceUnit = "DAY" | "WEEK" | "MONTH" | "YEAR";

export const UNIT_LABEL: Record<RecurrenceUnit, string> = {
  DAY: "Dia",
  WEEK: "Semana",
  MONTH: "Mês",
  YEAR: "Ano",
};

export interface IncomeRecurrence {
  id: string;
  name: string;
  description: string | null;
  amount: number;
  unit: RecurrenceUnit;
  interval: number;
  startDate: string;
  nextDate: string;
  maxOccurrences: number | null;
  occurrenceCount: number;
  isActive: boolean;
}

export interface Income {
  id: string;
  name: string;
  description: string | null;
  amount: number;
  date: string;
  recurrenceId: string | null;
  recurrence: {
    id: string;
    name: string;
    unit: RecurrenceUnit;
    interval: number;
  } | null;
}

export function toInputDate(isoDate: string): string {
  return isoDate.slice(0, 10);
}

export function displayDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("pt-BR");
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
