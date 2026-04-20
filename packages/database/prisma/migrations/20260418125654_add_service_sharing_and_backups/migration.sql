-- AlterTable
ALTER TABLE "services" ADD COLUMN     "auto_backup_retention" INTEGER,
ADD COLUMN     "auto_backup_schedule" VARCHAR(100),
ADD COLUMN     "is_shared" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "service_project_access" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linked_by" UUID,

    CONSTRAINT "service_project_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_project_access_project_id_idx" ON "service_project_access"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_project_access_service_id_project_id_key" ON "service_project_access"("service_id", "project_id");

-- AddForeignKey
ALTER TABLE "service_project_access" ADD CONSTRAINT "service_project_access_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_project_access" ADD CONSTRAINT "service_project_access_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
