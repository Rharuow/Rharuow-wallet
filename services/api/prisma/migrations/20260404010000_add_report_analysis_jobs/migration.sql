CREATE TYPE "public"."ReportAnalysisRequestMode" AS ENUM (
  'AUTO_WEB',
  'MANUAL_UPLOAD'
);

CREATE TYPE "public"."ReportAnalysisJobStatus" AS ENUM (
  'QUEUED',
  'SEARCHING_REPORT',
  'VALIDATING_REPORT',
  'ANALYZING_REPORT',
  'COMPLETED',
  'SEARCH_UNAVAILABLE',
  'FAILED'
);

CREATE TYPE "public"."ReportSearchCooldownSource" AS ENUM (
  'AUTO_WEB'
);

CREATE TABLE "public"."report_analysis_jobs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "asset_type" "public"."AssetReportAssetType" NOT NULL,
  "ticker" TEXT NOT NULL,
  "request_mode" "public"."ReportAnalysisRequestMode" NOT NULL,
  "status" "public"."ReportAnalysisJobStatus" NOT NULL DEFAULT 'QUEUED',
  "price_charged" DECIMAL(65,30),
  "analysis_id" TEXT,
  "source_id" TEXT,
  "failure_code" TEXT,
  "failure_message" TEXT,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "locked_at" TIMESTAMP(3),
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "report_analysis_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."report_search_cooldowns" (
  "id" TEXT NOT NULL,
  "asset_type" "public"."AssetReportAssetType" NOT NULL,
  "ticker" TEXT NOT NULL,
  "source" "public"."ReportSearchCooldownSource" NOT NULL,
  "reason_code" TEXT NOT NULL,
  "blocked_until" TIMESTAMP(3) NOT NULL,
  "last_job_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "report_search_cooldowns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "report_analysis_jobs_user_id_created_at_idx" ON "public"."report_analysis_jobs"("user_id", "created_at");
CREATE INDEX "report_analysis_jobs_asset_type_ticker_request_mode_created_at_idx" ON "public"."report_analysis_jobs"("asset_type", "ticker", "request_mode", "created_at");
CREATE INDEX "report_analysis_jobs_status_created_at_idx" ON "public"."report_analysis_jobs"("status", "created_at");
CREATE INDEX "report_analysis_jobs_analysis_id_idx" ON "public"."report_analysis_jobs"("analysis_id");
CREATE INDEX "report_analysis_jobs_source_id_idx" ON "public"."report_analysis_jobs"("source_id");

CREATE UNIQUE INDEX "report_search_cooldowns_asset_type_ticker_source_key" ON "public"."report_search_cooldowns"("asset_type", "ticker", "source");
CREATE INDEX "report_search_cooldowns_blocked_until_idx" ON "public"."report_search_cooldowns"("blocked_until");
CREATE INDEX "report_search_cooldowns_last_job_id_idx" ON "public"."report_search_cooldowns"("last_job_id");

ALTER TABLE "public"."report_analysis_jobs"
ADD CONSTRAINT "report_analysis_jobs_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."report_analysis_jobs"
ADD CONSTRAINT "report_analysis_jobs_analysis_id_fkey"
FOREIGN KEY ("analysis_id") REFERENCES "public"."asset_report_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."report_analysis_jobs"
ADD CONSTRAINT "report_analysis_jobs_source_id_fkey"
FOREIGN KEY ("source_id") REFERENCES "public"."asset_report_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."report_search_cooldowns"
ADD CONSTRAINT "report_search_cooldowns_last_job_id_fkey"
FOREIGN KEY ("last_job_id") REFERENCES "public"."report_analysis_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;