/*
  Warnings:

  - Added the required column `month_key` to the `asset_report_analyses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `report_mode` to the `asset_report_analyses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `month_key` to the `asset_report_sources` table without a default value. This is not possible if the table is not empty.
  - Added the required column `report_mode` to the `asset_report_sources` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ReportMode" AS ENUM ('BRAPI_TICKER', 'RI_UPLOAD_AI');

-- AlterTable (add as nullable first for backfill safety)
ALTER TABLE "asset_report_analyses" ADD COLUMN     "month_key" TEXT,
ADD COLUMN     "report_mode" "ReportMode";

-- AlterTable (add as nullable first for backfill safety)
ALTER TABLE "asset_report_sources" ADD COLUMN     "month_key" TEXT,
ADD COLUMN     "report_mode" "ReportMode";

-- Backfill source mode/month using current persisted source kind and creation timestamp (UTC month)
UPDATE "asset_report_sources"
SET
  "report_mode" = CASE
    WHEN "source_kind" = 'MANUAL_UPLOAD' THEN 'RI_UPLOAD_AI'::"ReportMode"
    ELSE 'BRAPI_TICKER'::"ReportMode"
  END,
  "month_key" = to_char("created_at" AT TIME ZONE 'UTC', 'YYYY-MM')
WHERE "report_mode" IS NULL OR "month_key" IS NULL;

-- Backfill analysis mode/month from linked source; fallback to analysis creation timestamp if needed
UPDATE "asset_report_analyses" AS a
SET
  "report_mode" = COALESCE(s."report_mode", 'BRAPI_TICKER'::"ReportMode"),
  "month_key" = COALESCE(s."month_key", to_char(a."created_at" AT TIME ZONE 'UTC', 'YYYY-MM'))
FROM "asset_report_sources" AS s
WHERE a."source_id" = s."id"
  AND (a."report_mode" IS NULL OR a."month_key" IS NULL);

UPDATE "asset_report_analyses"
SET
  "report_mode" = COALESCE("report_mode", 'BRAPI_TICKER'::"ReportMode"),
  "month_key" = COALESCE("month_key", to_char("created_at" AT TIME ZONE 'UTC', 'YYYY-MM'))
WHERE "report_mode" IS NULL OR "month_key" IS NULL;

-- Enforce NOT NULL after backfill
ALTER TABLE "asset_report_sources"
ALTER COLUMN "report_mode" SET NOT NULL,
ALTER COLUMN "month_key" SET NOT NULL;

ALTER TABLE "asset_report_analyses"
ALTER COLUMN "report_mode" SET NOT NULL,
ALTER COLUMN "month_key" SET NOT NULL;

-- CreateIndex
CREATE INDEX "asset_report_analyses_asset_type_ticker_report_mode_month_k_idx" ON "asset_report_analyses"("asset_type", "ticker", "report_mode", "month_key", "valid_until");

-- CreateIndex
CREATE INDEX "asset_report_sources_asset_type_ticker_report_mode_month_ke_idx" ON "asset_report_sources"("asset_type", "ticker", "report_mode", "month_key");

-- RenameIndex
ALTER INDEX "report_analysis_jobs_asset_type_ticker_request_mode_created_at_" RENAME TO "report_analysis_jobs_asset_type_ticker_request_mode_created_idx";
