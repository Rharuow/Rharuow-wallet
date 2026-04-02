"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Table, Button, Input, Modal, Card } from "rharuow-ds";
import { PencilIcon, TrashIcon, CheckIcon, XIcon } from "@/components/icons";

export type CostArea = {
  id: string;
  name: string;
  userId: string | null;
};

interface Props {
  areas: CostArea[];
  canWrite?: boolean;
}

export function AreasTable({ areas, canWrite = true }: Props) {
  const router = useRouter();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CostArea | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- criação ---
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function submitCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/costs/areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        setNewName("");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setCreateError(data.error ?? "Erro ao criar área.");
      }
    } finally {
      setCreating(false);
    }
  }

  function startEdit(area: CostArea) {
    setError(null);
    setEditingId(area.id);
    setEditingName(area.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
    setError(null);
  }

  async function submitEdit() {
    if (!editingId || !editingName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/costs/areas/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim() }),
      });
      if (res.ok) {
        cancelEdit();
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erro ao atualizar área.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/costs/areas/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok || res.status === 204) {
        setDeleteTarget(null);
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {/* Card de criação */}
      {canWrite ? (
        <Card className="p-4">
          <p className="mb-3 text-sm font-medium text-[var(--foreground)]">Nova área</p>
          <div className="flex gap-2">
            <Input
              name="newAreaName"
              label="Adicione uma Área"
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setCreateError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") submitCreate(); }}
              containerClassName="flex-1 mb-0"
            />
            <Button
              onClick={submitCreate}
              disabled={creating || !newName.trim()}
            >
              {creating ? "Adicionando…" : "Adicionar"}
            </Button>
          </div>
          {createError && (
            <p className="mt-2 text-xs text-red-500">{createError}</p>
          )}
        </Card>
      ) : (
        <Card className="p-4 text-sm text-slate-600">
          Esta carteira está em modo somente leitura para o seu usuário.
        </Card>
      )}

      <Table variant="bordered" size="sm" responsive>
        <Table.Header>
          <Table.Row>
            <Table.Cell as="th" scope="col" className="w-full">
              Nome
            </Table.Cell>
            <Table.Cell as="th" scope="col" align="center" className="whitespace-nowrap">
              Ações
            </Table.Cell>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {areas.length === 0 && (
            <Table.Row>
              <Table.Cell colSpan={2} align="center" className="text-slate-400 py-8">
                Nenhuma área encontrada.
              </Table.Cell>
            </Table.Row>
          )}

          {areas.map((area) => {
            const isEditing = editingId === area.id;
            const isGlobal = area.userId === null;

            return (
              <Table.Row key={area.id}>
                {/* Nome / input de edição */}
                <Table.Cell>
                  {isEditing ? (
                    <div className="flex flex-col gap-1">
                      <Input
                        name="areaName"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                        containerClassName="mb-0"
                      />
                      {error && (
                        <span className="text-xs text-red-500">{error}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm">{area.name}</span>
                  )}
                </Table.Cell>

                {/* Ações */}
                <Table.Cell align="center">
                  {isEditing ? (
                    <div className="flex items-center justify-center gap-2">
                      {/* Confirmar */}
                      <Button
                        variant="icon"
                        onClick={submitEdit}
                        disabled={saving || !editingName.trim()}
                        title="Confirmar edição"
                      >
                        <CheckIcon />
                      </Button>
                      {/* Cancelar */}
                      <Button
                        variant="icon"
                        onClick={cancelEdit}
                        title="Cancelar edição"
                      >
                        <XIcon />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      {/* Editar */}
                      <Button
                        variant="icon"
                        onClick={() => canWrite && !isGlobal && startEdit(area)}
                        disabled={isGlobal || !canWrite}
                        title={isGlobal ? "Área padrão do sistema" : canWrite ? "Editar área" : "Somente leitura"}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="icon"
                        onClick={() => canWrite && !isGlobal && setDeleteTarget(area)}
                        disabled={isGlobal || !canWrite}
                        title={isGlobal ? "Área padrão do sistema" : canWrite ? "Remover área" : "Somente leitura"}
                      >
                        <TrashIcon />
                      </Button>
                    </div>
                  )}
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table>

      {/* Modal de confirmação de deleção */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        size="sm"
        closeOnEscape
        closeOnOverlayClick
      >
        <Modal.Header>Confirmar remoção</Modal.Header>
        <Modal.Body>
          <p className="text-sm text-[var(--foreground)]">
            Deseja remover a área{" "}
            <strong>&ldquo;{deleteTarget?.name}&rdquo;</strong>?
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Todos os tipos e custos vinculados a esta área também serão removidos.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Removendo…" : "Confirmar"}
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </>
  );
}
