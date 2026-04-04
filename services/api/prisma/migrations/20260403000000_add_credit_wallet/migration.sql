CREATE TYPE "public"."CreditLedgerEntryKind" AS ENUM (
  'CREDIT',
  'DEBIT',
  'REVERSAL',
  'ADJUSTMENT'
);

CREATE TYPE "public"."CreditTopupOrderStatus" AS ENUM (
  'PENDING',
  'PAID',
  'FAILED',
  'CANCELED'
);

CREATE TABLE "public"."user_credit_balances" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_credit_balances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."credit_topup_orders" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  "status" "public"."CreditTopupOrderStatus" NOT NULL DEFAULT 'PENDING',
  "stripe_checkout_session_id" TEXT,
  "stripe_payment_intent_id" TEXT,
  "metadata" JSONB,
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "credit_topup_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."credit_ledger_entries" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "topup_order_id" TEXT,
  "kind" "public"."CreditLedgerEntryKind" NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  "balance_after" DECIMAL(65,30) NOT NULL,
  "description" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "credit_ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_credit_balances_user_id_key" ON "public"."user_credit_balances"("user_id");
CREATE UNIQUE INDEX "credit_topup_orders_stripe_checkout_session_id_key" ON "public"."credit_topup_orders"("stripe_checkout_session_id");
CREATE UNIQUE INDEX "credit_topup_orders_stripe_payment_intent_id_key" ON "public"."credit_topup_orders"("stripe_payment_intent_id");
CREATE INDEX "credit_topup_orders_user_id_status_created_at_idx" ON "public"."credit_topup_orders"("user_id", "status", "created_at");
CREATE INDEX "credit_ledger_entries_user_id_created_at_idx" ON "public"."credit_ledger_entries"("user_id", "created_at");
CREATE INDEX "credit_ledger_entries_topup_order_id_idx" ON "public"."credit_ledger_entries"("topup_order_id");

ALTER TABLE "public"."user_credit_balances"
ADD CONSTRAINT "user_credit_balances_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."credit_topup_orders"
ADD CONSTRAINT "credit_topup_orders_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."credit_ledger_entries"
ADD CONSTRAINT "credit_ledger_entries_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."credit_ledger_entries"
ADD CONSTRAINT "credit_ledger_entries_topup_order_id_fkey"
FOREIGN KEY ("topup_order_id") REFERENCES "public"."credit_topup_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;