/*
  Warnings:

  - You are about to drop the column `sourceType` on the `logs` table. All the data in the column will be lost.
  - You are about to drop the column `sourceType` on the `metrics` table. All the data in the column will be lost.
  - Added the required column `source_type` to the `logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `source_type` to the `metrics` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "logs_sourceType_source_id_idx";

-- DropIndex
DROP INDEX "metrics_sourceType_source_id_idx";

-- AlterTable
ALTER TABLE "logs" DROP COLUMN "sourceType",
ADD COLUMN     "source_type" "source_type" NOT NULL;

-- AlterTable
ALTER TABLE "metrics" DROP COLUMN "sourceType",
ADD COLUMN     "source_type" "source_type" NOT NULL;

-- CreateIndex
CREATE INDEX "logs_source_type_source_id_idx" ON "logs"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "metrics_source_type_source_id_idx" ON "metrics"("source_type", "source_id");
