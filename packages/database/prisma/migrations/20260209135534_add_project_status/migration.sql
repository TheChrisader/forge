-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'inactive';

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");
