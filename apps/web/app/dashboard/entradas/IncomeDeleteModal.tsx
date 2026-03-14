"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Button } from "rharuow-ds";
import { formatBRL } from "./types";
import type { Income } from "./types";

interface Props {
  target: Income | null;
  onClose: () => void;
}

export function IncomeDeleteModal({ target, onClose }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!target) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/incomes/${target.id}`, { method: "DELETE" });
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
          Deseja remover a entrada{" "}
          {target ? (
            <>
              <strong>&ldquo;{target.name}&rdquo;</strong> no valor de{" "}
              <strong>{formatBRL(Number(target.amount))}</strong>
            </>
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
