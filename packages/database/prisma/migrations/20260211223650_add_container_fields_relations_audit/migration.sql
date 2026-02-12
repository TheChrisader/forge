/*
  Warnings:

  - Added the required column `updatedAt` to the `Container` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Container" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "env" JSONB,
ADD COLUMN     "network" TEXT,
ADD COLUMN     "ports" JSONB,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" TEXT,
ADD COLUMN     "volumes" JSONB;

-- AlterTable
ALTER TABLE "Deployment" ADD COLUMN     "updatedBy" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "updatedBy" TEXT;

-- CreateIndex
CREATE INDEX "Container_network_idx" ON "Container"("network");

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
