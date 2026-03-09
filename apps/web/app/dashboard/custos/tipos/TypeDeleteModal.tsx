"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Button } from "rharuow-ds";
import { CostType } from "../types";

interface Props {
  target: CostType;
  onClose: () => void;
}

export function TypeDeleteModal({ target, onClose }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/costs/types/${target.id}`, {
        method: "DELETE",
      });
      if (res.ok || res.status === 204) {
        onClose();
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal open onClose={onClose} size="sm" closeOnEscape closeOnOverlayClick>
      <Modal.Header>Confirmar remoção</Modal.Header>
      <Modal.Body>
        <p className="text-sm text-[var(--foreground)]">
          Deseja remover o tipo{" "}
          <strong>&ldquo;{target.name}&rdquo;</strong>?
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Todos os custos vinculados a este tipo também serão removidos.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            Cancelar
          </Button>
          <Button onClick={handleDelete} disabled={deleting}>
            {deleting ? "Removendo…" : "Confirmar"}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
