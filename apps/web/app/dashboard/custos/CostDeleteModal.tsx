"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Button } from "rharuow-ds";
import { formatBRL } from "@/lib/format";
import type { Cost, CostType } from "./types";

interface Props {
  target: Cost | null;
  types: CostType[];
  onClose: () => void;
}

export function CostDeleteModal({ target, types, onClose }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const targetType = target ? types.find((t) => t.id === target.costTypeId) : null;

  async function confirmDelete() {
    if (!target) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/costs/${target.id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        onClose();
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      size="sm"
      closeOnEscape
      closeOnOverlayClick
    >
      <Modal.Header>Confirmar remoção</Modal.Header>
      <Modal.Body>
        <p className="text-sm text-[var(--foreground)]">
          Deseja remover este custo
          {targetType ? (
            <> do tipo <strong>&ldquo;{targetType.name}&rdquo;</strong></>
          ) : null}
          {target ? (
            <> no valor de <strong>{formatBRL(Number(target.amount))}</strong></>
          ) : null}
          ?
        </p>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            Cancelar
          </Button>
          <Button onClick={confirmDelete} disabled={deleting}>
            {deleting ? "Removendo…" : "Confirmar"}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
