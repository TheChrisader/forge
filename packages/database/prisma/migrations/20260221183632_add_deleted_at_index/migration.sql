-- AlterTable
ALTER TABLE "build_caches" ADD COLUMN     "deleted_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "build_caches_deleted_at_idx" ON "build_caches"("deleted_at");
