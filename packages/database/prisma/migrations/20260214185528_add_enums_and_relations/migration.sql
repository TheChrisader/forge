/*
  Warnings:

  - You are about to drop the column `ports` on the `Container` table. All the data in the column will be lost.
  - You are about to drop the column `volumes` on the `Container` table. All the data in the column will be lost.
  - The `status` column on the `Container` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `healthStatus` column on the `Container` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Project` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `name` on table `Container` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `status` on the `Deployment` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('PENDING', 'BUILDING', 'DEPLOYING', 'RUNNING', 'FAILED');

-- CreateEnum
CREATE TYPE "ContainerStatus" AS ENUM ('CREATING', 'RUNNING', 'STOPPED', 'ERROR');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('HEALTHY', 'UNHEALTHY', 'STARTING');

-- CreateEnum
CREATE TYPE "PortProtocol" AS ENUM ('TCP', 'UDP');

-- CreateEnum
CREATE TYPE "VolumeMode" AS ENUM ('RW', 'RO');

-- AlterTable
ALTER TABLE "Container" DROP COLUMN "ports",
DROP COLUMN "volumes",
DROP COLUMN "status",
ADD COLUMN     "status" "ContainerStatus" NOT NULL DEFAULT 'CREATING',
DROP COLUMN "healthStatus",
ADD COLUMN     "healthStatus" "HealthStatus",
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "name" SET DEFAULT '';

-- AlterTable
ALTER TABLE "Deployment" DROP COLUMN "status",
ADD COLUMN     "status" "DeploymentStatus" NOT NULL;

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "status",
ADD COLUMN     "status" "ProjectStatus" NOT NULL DEFAULT 'INACTIVE';

-- CreateTable
CREATE TABLE "PortMapping" (
    "id" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "containerPort" INTEGER NOT NULL,
    "hostPort" INTEGER,
    "protocol" "PortProtocol" NOT NULL DEFAULT 'TCP',

    CONSTRAINT "PortMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolumeMapping" (
    "id" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "mode" "VolumeMode" NOT NULL DEFAULT 'RW',

    CONSTRAINT "VolumeMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortMapping_containerId_idx" ON "PortMapping"("containerId");

-- CreateIndex
CREATE INDEX "VolumeMapping_containerId_idx" ON "VolumeMapping"("containerId");

-- CreateIndex
CREATE INDEX "Container_status_idx" ON "Container"("status");

-- CreateIndex
CREATE INDEX "Deployment_status_idx" ON "Deployment"("status");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- AddForeignKey
ALTER TABLE "PortMapping" ADD CONSTRAINT "PortMapping_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolumeMapping" ADD CONSTRAINT "VolumeMapping_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE CASCADE ON UPDATE CASCADE;
