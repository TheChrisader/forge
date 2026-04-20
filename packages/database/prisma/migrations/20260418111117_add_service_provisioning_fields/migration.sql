-- AlterTable
ALTER TABLE "services" ADD COLUMN     "container_id" VARCHAR(100),
ADD COLUMN     "internal_hostname" VARCHAR(255),
ADD COLUMN     "version" VARCHAR(50),
ADD COLUMN     "volume_name" VARCHAR(255);
