"use client";

import { Table, Card } from "rharuow-ds";
import { formatBRL } from "@/lib/format";

interface ByType {
  typeId: string;
  typeName: string;
  areaName: string;
  total: number;
  count: number;
}

interface ByArea {
  areaId: string;
  areaName: string;
  total: number;
}

interface Props {
  byType: ByType[];
  byArea: ByArea[];
  grandTotal: number;
}

export function BreakdownTable({ byType, byArea, grandTotal }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {/* Por área */}
      <Card className="p-4">
        <p className="mb-3 text-sm font-semibold text-[var(--foreground)]">
          Resumo por área
        </p>
        <Table variant="bordered" size="sm" responsive>
          <Table.Header>
            <Table.Row>
              <Table.Cell as="th" scope="col" className="w-full">Área</Table.Cell>
              <Table.Cell as="th" scope="col" align="right">Total</Table.Cell>
              <Table.Cell as="th" scope="col" align="right">%</Table.Cell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {byArea.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={3} align="center" className="py-6 text-slate-400">
                  Sem dados
                </Table.Cell>
              </Table.Row>
            )}
            {byArea.map((a) => (
              <Table.Row key={a.areaId}>
                <Table.Cell>
                  <span className="text-sm">{a.areaName}</span>
                </Table.Cell>
                <Table.Cell align="right">
                  <span className="text-sm font-medium">{formatBRL(a.total)}</span>
                </Table.Cell>
                <Table.Cell align="right">
                  <span className="text-sm text-slate-500">
                    {grandTotal > 0 ? ((a.total / grandTotal) * 100).toFixed(1) : "0.0"}%
                  </span>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Card>

      {/* Por tipo */}
      <Card className="p-4">
        <p className="mb-3 text-sm font-semibold text-[var(--foreground)]">
          Detalhamento por tipo
        </p>
        <Table variant="bordered" size="sm" responsive>
          <Table.Header>
            <Table.Row>
              <Table.Cell as="th" scope="col">Área</Table.Cell>
              <Table.Cell as="th" scope="col" className="w-full">Tipo</Table.Cell>
              <Table.Cell as="th" scope="col" align="right">Lançamentos</Table.Cell>
              <Table.Cell as="th" scope="col" align="right">Total</Table.Cell>
              <Table.Cell as="th" scope="col" align="right">%</Table.Cell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {byType.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={5} align="center" className="py-6 text-slate-400">
                  Sem dados
                </Table.Cell>
              </Table.Row>
            )}
            {byType.map((t) => (
              <Table.Row key={t.typeId}>
                <Table.Cell>
                  <span className="text-sm text-slate-500">{t.areaName}</span>
                </Table.Cell>
                <Table.Cell>
                  <span className="text-sm">{t.typeName}</span>
                </Table.Cell>
                <Table.Cell align="right">
                  <span className="text-sm text-slate-500">{t.count}</span>
                </Table.Cell>
                <Table.Cell align="right">
                  <span className="text-sm font-medium">{formatBRL(t.total)}</span>
                </Table.Cell>
                <Table.Cell align="right">
                  <span className="text-sm text-slate-500">
                    {grandTotal > 0 ? ((t.total / grandTotal) * 100).toFixed(1) : "0.0"}%
                  </span>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Card>
    </div>
  );
}
