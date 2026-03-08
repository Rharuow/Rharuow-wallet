-- CreateIndex
CREATE INDEX "cost_areas_user_id_name_idx" ON "cost_areas"("user_id", "name");

-- CreateIndex
CREATE INDEX "cost_types_area_id_user_id_name_idx" ON "cost_types"("area_id", "user_id", "name");
