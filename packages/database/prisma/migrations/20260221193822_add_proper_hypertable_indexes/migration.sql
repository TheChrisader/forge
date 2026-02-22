/*
  Warnings:

  - The primary key for the `alert_notifications` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `audit_logs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `build_logs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `logs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `metrics` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `webhook_deliveries` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "alert_notifications" DROP CONSTRAINT "alert_notifications_pkey",
ADD COLUMN     "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD CONSTRAINT "alert_notifications_pkey" PRIMARY KEY ("id", "timestamp");

-- AlterTable
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_pkey",
ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id", "timestamp");

-- AlterTable
ALTER TABLE "build_logs" DROP CONSTRAINT "build_logs_pkey",
ADD CONSTRAINT "build_logs_pkey" PRIMARY KEY ("id", "timestamp");

-- AlterTable
ALTER TABLE "logs" DROP CONSTRAINT "logs_pkey",
ADD CONSTRAINT "logs_pkey" PRIMARY KEY ("id", "timestamp");

-- AlterTable
ALTER TABLE "metrics" DROP CONSTRAINT "metrics_pkey",
ADD CONSTRAINT "metrics_pkey" PRIMARY KEY ("id", "timestamp");

-- AlterTable
ALTER TABLE "webhook_deliveries" DROP CONSTRAINT "webhook_deliveries_pkey",
ADD CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id", "created_at");
