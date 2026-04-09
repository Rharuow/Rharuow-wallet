CREATE TYPE "public"."AssetReportAssetType" AS ENUM (
  'STOCK',
  'FII'
);

CREATE TYPE "public"."AssetReportSourceKind" AS ENUM (
  'AUTO_FOUND',
  'MANUAL_UPLOAD'
);

CREATE TABLE "public"."asset_report_sources" (
  "id" TEXT NOT NULL,
  "asset_type" "public"."AssetReportAssetType" NOT NULL,
  "ticker" TEXT NOT NULL,
  "source_kind" "public"."AssetReportSourceKind" NOT NULL,
  "source_url" TEXT,
  "storage_key" TEXT,
  "original_file_name" TEXT,
  "document_fingerprint" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "asset_report_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."asset_report_analyses" (
  "id" TEXT NOT NULL,
  "asset_type" "public"."AssetReportAssetType" NOT NULL,
  "ticker" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "analysis_text" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "valid_until" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "asset_report_analyses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."user_asset_report_accesses" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "analysis_id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_asset_report_accesses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "asset_report_sources_asset_type_ticker_document_fingerprint_key" ON "public"."asset_report_sources"("asset_type", "ticker", "document_fingerprint");
CREATE INDEX "asset_report_sources_asset_type_ticker_created_at_idx" ON "public"."asset_report_sources"("asset_type", "ticker", "created_at");
CREATE UNIQUE INDEX "asset_report_analyses_asset_type_ticker_source_id_key" ON "public"."asset_report_analyses"("asset_type", "ticker", "source_id");
CREATE INDEX "asset_report_analyses_asset_type_ticker_valid_until_idx" ON "public"."asset_report_analyses"("asset_type", "ticker", "valid_until");
CREATE UNIQUE INDEX "user_asset_report_accesses_user_id_analysis_id_key" ON "public"."user_asset_report_accesses"("user_id", "analysis_id");
CREATE INDEX "user_asset_report_accesses_user_id_expires_at_idx" ON "public"."user_asset_report_accesses"("user_id", "expires_at");
CREATE INDEX "user_asset_report_accesses_analysis_id_expires_at_idx" ON "public"."user_asset_report_accesses"("analysis_id", "expires_at");

ALTER TABLE "public"."asset_report_analyses"
ADD CONSTRAINT "asset_report_analyses_source_id_fkey"
FOREIGN KEY ("source_id") REFERENCES "public"."asset_report_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."user_asset_report_accesses"
ADD CONSTRAINT "user_asset_report_accesses_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."user_asset_report_accesses"
ADD CONSTRAINT "user_asset_report_accesses_analysis_id_fkey"
FOREIGN KEY ("analysis_id") REFERENCES "public"."asset_report_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;