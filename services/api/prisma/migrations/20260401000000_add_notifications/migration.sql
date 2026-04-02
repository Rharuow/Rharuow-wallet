-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM (
  'WALLET_INVITE_SENT',
  'WALLET_INVITE_ACCEPTED',
  'WALLET_INVITE_DECLINED',
  'WALLET_INVITE_REVOKED'
);

-- CreateTable
CREATE TABLE "public"."notifications" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" "public"."NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "data" JSONB,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "public"."notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "public"."notifications"("user_id", "read_at", "created_at");

-- AddForeignKey
ALTER TABLE "public"."notifications"
ADD CONSTRAINT "notifications_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;