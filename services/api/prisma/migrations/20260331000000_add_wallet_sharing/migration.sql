-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED');

-- CreateEnum
CREATE TYPE "WalletPermission" AS ENUM ('READ', 'FULL');

-- CreateTable
CREATE TABLE "wallet_invites" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "guest_email" TEXT NOT NULL,
    "guest_id" TEXT,
    "token" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_accesses" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "guest_id" TEXT NOT NULL,
    "invite_id" TEXT NOT NULL,
    "permission" "WalletPermission" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_invites_token_key" ON "wallet_invites"("token");

-- CreateIndex
CREATE INDEX "wallet_invites_owner_id_guest_email_status_idx" ON "wallet_invites"("owner_id", "guest_email", "status");

-- CreateIndex
CREATE INDEX "wallet_invites_guest_email_status_idx" ON "wallet_invites"("guest_email", "status");

-- CreateIndex
CREATE INDEX "wallet_invites_guest_id_status_idx" ON "wallet_invites"("guest_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_accesses_invite_id_key" ON "wallet_accesses"("invite_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_accesses_owner_id_guest_id_key" ON "wallet_accesses"("owner_id", "guest_id");

-- CreateIndex
CREATE INDEX "wallet_accesses_guest_id_idx" ON "wallet_accesses"("guest_id");

-- CreateIndex
CREATE INDEX "wallet_accesses_owner_id_idx" ON "wallet_accesses"("owner_id");

-- AddForeignKey
ALTER TABLE "wallet_invites" ADD CONSTRAINT "wallet_invites_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_invites" ADD CONSTRAINT "wallet_invites_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_accesses" ADD CONSTRAINT "wallet_accesses_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_accesses" ADD CONSTRAINT "wallet_accesses_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_accesses" ADD CONSTRAINT "wallet_accesses_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "wallet_invites"("id") ON DELETE CASCADE ON UPDATE CASCADE;