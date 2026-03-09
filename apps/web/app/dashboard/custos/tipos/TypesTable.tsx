"use client";

import { useState, useEffect } from "react";
import { Table } from "rharuow-ds";
import { CostType } from "../types";
import { TypeCreateCard } from "./TypeCreateCard";
import { TypeMobileCard } from "./TypeMobileCard";
import { TypeTableRow } from "./TypeTableRow";
import { TypeDeleteModal } from "./TypeDeleteModal";

type Area = { id: string; name: string };

interface Props {
  types: CostType[];
  areas: Area[];
}

export function TypesTable({ types, areas }: Props) {
  const [deleteTarget, setDeleteTarget] = useState<CostType | null>(null);
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <>
      <TypeCreateCard areas={areas} />

      {/* Mobile: cards */}
      {isMobile && (
        <div className="flex flex-col gap-3">
          {types.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">
              Nenhum tipo encontrado.
            </p>
          )}
          {types.map((type) => (
            <TypeMobileCard
              key={type.id}
              type={type}
              areas={areas}
              onDeleteRequest={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {!isMobile && (
        <Table variant="bordered" size="sm" responsive>
          <Table.Header>
            <Table.Row>
              <Table.Cell as="th" scope="col">
                Nome
              </Table.Cell>
              <Table.Cell as="th" scope="col">
                Área
              </Table.Cell>
              <Table.Cell as="th" scope="col" align="center" className="whitespace-nowrap">
                Ações
              </Table.Cell>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {types.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={3} align="center" className="text-slate-400 py-8">
                  Nenhum tipo encontrado.
                </Table.Cell>
              </Table.Row>
            )}
            {types.map((type) => (
              <TypeTableRow
                key={type.id}
                type={type}
                areas={areas}
                onDeleteRequest={setDeleteTarget}
              />
            ))}
          </Table.Body>
        </Table>
      )}

      {deleteTarget && (
        <TypeDeleteModal
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
