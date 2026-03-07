-- CreateTable
CREATE TABLE "stock_segments" (
    "id" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_pt" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_segments_name_en_key" ON "stock_segments"("name_en");
