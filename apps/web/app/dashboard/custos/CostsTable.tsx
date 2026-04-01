"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Table, Pagination } from "rharuow-ds";
import { CostCreateCard } from "./CostCreateCard";
import { CostDeleteModal } from "./CostDeleteModal";
import { CostMobileCard } from "./CostMobileCard";
import { CostTableRow } from "./CostTableRow";
import { useCostEdit } from "./hooks/useCostEdit";
import { useCostLists } from "./hooks/useCostLists";
import type { CostArea } from "./areas/AreasTable";

import type { Cost, CostRecurrence, CostType } from "./types";

// Re-export types consumed by page.tsx and other modules
export type { Cost, CostType, CostRecurrence };

interface Props {
  costs: Cost[];
  types: CostType[];
  areas: CostArea[];
  recurrences: CostRecurrence[];
  currentPage: number;
  totalPages: number;
  isPremium?: boolean;
  canWrite?: boolean;
}

export function CostsTable({ costs, types, areas, recurrences, currentPage, totalPages, isPremium = false, canWrite = true }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`${pathname}?${params.toString()}`);
  }

  const lists = useCostLists({ initialAreas: areas, initialTypes: types });
  const edit = useCostEdit({ recurrences, localTypes: lists.localTypes });

  const [deleteTarget, setDeleteTarget] = useState<Cost | null>(null);

  return (
    <>
      {canWrite ? (
        <CostCreateCard areas={areas} types={types} isPremium={isPremium} />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Esta carteira está em modo somente leitura para o seu usuário.
        </div>
      )}

      {/* ── Mobile: cards ── */}
      <div className="flex flex-col gap-3 md:hidden">
        {costs.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">Nenhum custo registrado.</p>
        )}
        {costs.map((cost) => (
          <CostMobileCard
            key={cost.id}
            cost={cost}
            localAreas={lists.localAreas}
            localTypes={lists.localTypes}
            edit={edit}
            lists={lists}
            onDeleteRequest={setDeleteTarget}
            canWrite={canWrite}
          />
        ))}
      </div>

      {/* ── Desktop: tabela ── */}
      <div className="hidden md:block">
        <Table variant="bordered" size="sm" responsive>
          <Table.Header>
            <Table.Row>
              <Table.Cell as="th" scope="col" className="whitespace-nowrap">Data</Table.Cell>
              <Table.Cell as="th" scope="col">Área</Table.Cell>
              <Table.Cell as="th" scope="col">Tipo</Table.Cell>
              <Table.Cell as="th" scope="col" className="whitespace-nowrap">Valor</Table.Cell>
              <Table.Cell as="th" scope="col" className="w-full">Descrição</Table.Cell>
              <Table.Cell as="th" scope="col" align="center" className="whitespace-nowrap">Ações</Table.Cell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {costs.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={6} align="center" className="text-slate-400 py-8">
                  Nenhum custo registrado.
                </Table.Cell>
              </Table.Row>
            )}
            {costs.map((cost) => (
              <CostTableRow
                key={cost.id}
                cost={cost}
                localAreas={lists.localAreas}
                localTypes={lists.localTypes}
                edit={edit}
                lists={lists}
                onDeleteRequest={setDeleteTarget}
                canWrite={canWrite}
              />
            ))}
          </Table.Body>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
          />
        </div>
      )}

      <CostDeleteModal
        target={deleteTarget}
        types={lists.localTypes}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
