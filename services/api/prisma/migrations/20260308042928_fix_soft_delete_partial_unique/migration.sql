-- DropIndex: remove os unique indexes que não consideram soft delete
DROP INDEX "cost_areas_user_id_name_key";

-- DropIndex
DROP INDEX "cost_types_area_id_user_id_name_key";

-- CreateIndex: partial unique indexes — a constraint só se aplica a registros
-- ativos (deleted_at IS NULL). Registros soft-deletados são ignorados,
-- permitindo reutilizar o mesmo nome após uma deleção lógica.
CREATE UNIQUE INDEX "cost_areas_user_id_name_key"
  ON "cost_areas"("user_id", "name")
  WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "cost_types_area_id_user_id_name_key"
  ON "cost_types"("area_id", "user_id", "name")
  WHERE (deleted_at IS NULL);
