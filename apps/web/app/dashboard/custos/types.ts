export type CostType = {
  id: string;
  name: string;
  areaId: string;
  area: { id: string; name: string; userId: string | null };
};

export type CostRecurrence = {
  id: string;
  costTypeId: string;
  amount: number;
  description: string | null;
  unit: string;
  interval: number;
  maxOccurrences: number | null;
  isActive: boolean;
};

export type Cost = {
  id: string;
  costTypeId: string;
  amount: number;
  description: string | null;
  date: string;
  recurrenceId: string | null;
  costType: { id: string; name: string; areaId: string };
};

export const UNIT_LABEL: Record<string, string> = {
  DAY: "Dia",
  WEEK: "Semana",
  MONTH: "Mês",
  YEAR: "Ano",
};

export function toInputDate(isoDate: string): string {
  return isoDate.slice(0, 10);
}

export function displayDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
