"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Table, Pagination } from "rharuow-ds";
import { IncomeCreateCard } from "./IncomeCreateCard";
import { IncomeDeleteModal } from "./IncomeDeleteModal";
import { IncomeMobileCard } from "./IncomeMobileCard";
import { IncomeTableRow } from "./IncomeTableRow";
import { useIncomeEdit } from "./hooks/useIncomeEdit";
import type { Income, IncomeRecurrence } from "./types";

export type { Income, IncomeRecurrence };

interface Props {
  incomes: Income[];
  recurrences: IncomeRecurrence[];
  currentPage: number;
  totalPages: number;
}

export function IncomesTable({
  incomes,
  recurrences,
  currentPage,
  totalPages,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`${pathname}?${params.toString()}`);
  }

  const edit = useIncomeEdit();
  const [deleteTarget, setDeleteTarget] = useState<Income | null>(null);

  return (
    <>
      <IncomeCreateCard />

      {/* ── Mobile: cards ── */}
      <div className="flex flex-col gap-3 md:hidden">
        {incomes.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">
            Nenhuma entrada registrada.
          </p>
        )}
        {incomes.map((income) => (
          <IncomeMobileCard
            key={income.id}
            income={income}
            recurrences={recurrences}
            edit={edit}
            onDeleteRequest={setDeleteTarget}
          />
        ))}
      </div>

      {/* ── Desktop: tabela ── */}
      <div className="hidden md:block">
        <Table variant="bordered" size="sm" responsive>
          <Table.Header>
            <Table.Row>
              <Table.Cell as="th" scope="col" className="whitespace-nowrap">
                Data
              </Table.Cell>
              <Table.Cell as="th" scope="col">
                Nome
              </Table.Cell>
              <Table.Cell as="th" scope="col" className="whitespace-nowrap">
                Valor
              </Table.Cell>
              <Table.Cell as="th" scope="col" className="w-full">
                Descrição
              </Table.Cell>
              <Table.Cell as="th" scope="col" className="whitespace-nowrap">
                Recorrência
              </Table.Cell>
              <Table.Cell as="th" scope="col" align="center" className="whitespace-nowrap">
                Ações
              </Table.Cell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {incomes.length === 0 && (
              <Table.Row>
                <Table.Cell
                  colSpan={6}
                  align="center"
                  className="text-slate-400 py-8"
                >
                  Nenhuma entrada registrada.
                </Table.Cell>
              </Table.Row>
            )}
            {incomes.map((income) => (
              <IncomeTableRow
                key={income.id}
                income={income}
                recurrences={recurrences}
                edit={edit}
                onDeleteRequest={setDeleteTarget}
              />
            ))}
          </Table.Body>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center pt-2">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
          />
        </div>
      )}

      <IncomeDeleteModal
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
