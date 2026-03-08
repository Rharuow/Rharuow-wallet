"use client";

import { useState } from "react";
import type { CostArea } from "../areas/AreasTable";
import type { CostType } from "../types";

interface UseCostListsOptions {
  initialAreas: CostArea[];
  initialTypes: CostType[];
}

export function useCostLists({ initialAreas, initialTypes }: UseCostListsOptions) {
  const [localAreas, setLocalAreas] = useState<CostArea[]>(initialAreas);
  const [localTypes, setLocalTypes] = useState<CostType[]>(initialTypes);

  // --- inline area creation ---
  const [showCreateArea, setShowCreateArea] = useState<"new" | "edit" | null>(null);
  const [inlineAreaName, setInlineAreaName] = useState("");
  const [creatingArea, setCreatingArea] = useState(false);
  const [createAreaError, setCreateAreaError] = useState<string | null>(null);

  // --- inline type creation ---
  const [showCreateType, setShowCreateType] = useState<"new" | "edit" | null>(null);
  const [inlineTypeName, setInlineTypeName] = useState("");
  const [creatingType, setCreatingType] = useState(false);
  const [createTypeError, setCreateTypeError] = useState<string | null>(null);

  async function submitInlineArea(
    context: "new" | "edit",
    onSuccess: (newAreaId: string) => void,
  ) {
    if (!inlineAreaName.trim()) return;
    setCreatingArea(true);
    setCreateAreaError(null);
    try {
      const res = await fetch("/api/costs/areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: inlineAreaName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const newArea: CostArea = data.area ?? data;
        setLocalAreas((prev) => [...prev, newArea]);
        setInlineAreaName("");
        setShowCreateArea(null);
        onSuccess(newArea.id);
      } else {
        setCreateAreaError(data.error ?? "Erro ao criar área.");
      }
    } finally {
      setCreatingArea(false);
    }
  }

  async function submitInlineType(
    context: "new" | "edit",
    areaId: string,
    onSuccess: (newTypeId: string) => void,
  ) {
    if (!inlineTypeName.trim()) return;
    if (!areaId) {
      setCreateTypeError("Selecione uma área primeiro.");
      return;
    }
    setCreatingType(true);
    setCreateTypeError(null);
    try {
      const res = await fetch("/api/costs/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: inlineTypeName.trim(), areaId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const raw = data.type ?? data;
        const matchedArea = localAreas.find((a) => a.id === areaId);
        const newType: CostType = {
          ...raw,
          area: {
            id: matchedArea?.id ?? areaId,
            name: matchedArea?.name ?? "",
            userId: matchedArea?.userId ?? null,
          },
        };
        setLocalTypes((prev) => [...prev, newType]);
        setInlineTypeName("");
        setShowCreateType(null);
        onSuccess(newType.id);
      } else {
        setCreateTypeError(data.error ?? "Erro ao criar tipo.");
      }
    } finally {
      setCreatingType(false);
    }
  }

  return {
    localAreas,
    localTypes,
    // area inline
    showCreateArea,
    setShowCreateArea,
    inlineAreaName,
    setInlineAreaName,
    creatingArea,
    createAreaError,
    setCreateAreaError,
    submitInlineArea,
    // type inline
    showCreateType,
    setShowCreateType,
    inlineTypeName,
    setInlineTypeName,
    creatingType,
    createTypeError,
    setCreateTypeError,
    submitInlineType,
  };
}
