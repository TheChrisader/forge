import type { IJobContext } from "@forge/queue";
import type { IContainerRuntime } from "@forge/docker";
import type { ServiceJobData } from "@forge/service-catalog";
import { backupStrategyRegistry } from "@forge/service-catalog";
import { getDatabaseClient } from "@forge/database";
import { LoggerService } from "@forge/logger";
import { toPrismaJson, type LogLevel } from "@forge/types";
import { LocalStorageProvider } from "@forge/storage";
import { PassThrough } from "node:stream";
import { emitServiceStatus } from "../utils/emit-status.js";

const logger = new LoggerService({
  level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
  enabled: true,
  name: "backup-handler",
});

interface BackupHandlerContext {
  runtime: IContainerRuntime;
  storage: LocalStorageProvider;
}

export async function handleBackup(
  context: IJobContext<ServiceJobData>,
  deps: BackupHandlerContext
): Promise<void> {
  const { serviceId, backupId } = context.job.data;

  if (!backupId) {
    throw new Error("Backup ID is required");
  }

  const db = getDatabaseClient();

  const service = await db.service.findUnique({ where: { id: serviceId } });
  if (!service) {
    throw new Error(`Service ${serviceId} not found`);
  }

  if (!service.containerId) {
    throw new Error(`Service ${serviceId} has no container — cannot backup`);
  }

  if (!service.engine) {
    throw new Error(`Service ${serviceId} has no engine — cannot backup`);
  }

  const backup = await db.serviceBackup.findUnique({ where: { id: backupId } });
  if (!backup) {
    throw new Error(`Backup record ${backupId} not found`);
  }

  // Check if backup is already in progress
  if (backup.status !== "PENDING") {
    logger.warn("Backup is not in PENDING state, skipping", {
      backupId,
      status: backup.status,
    });
    return;
  }

  // Resolve backup strategy
  const strategy = backupStrategyRegistry.get(service.engine);
  if (!strategy.supported) {
    await db.serviceBackup.update({
      where: { id: backupId },
      data: {
        status: "FAILED",
        error: `Engine "${service.engine}" does not support backup`,
        completedAt: new Date(),
      },
    });
    throw new Error(`Engine "${service.engine}" does not support backup`);
  }

  // Mark backup as in-progress and service as backing up
  await db.$transaction([
    db.serviceBackup.update({
      where: { id: backupId },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    }),
    db.service.update({
      where: { id: serviceId },
      data: { status: "BACKING_UP" },
    }),
  ]);

  await emitServiceStatus(context, "BACKING_UP");

  const previousStatus: string = service.status;

  try {
    const backupResult = await strategy.runBackup({
      runtime: deps.runtime,
      containerId: service.containerId,
      service: {
        id: service.id,
        engine: service.engine,
        connectionUsername: service.connectionUsername,
        connectionPassword: service.connectionPassword,
        connectionDatabase: service.connectionDatabase,
        connectionPort: service.connectionPort,
      },
      backupId,
    });

    const storageKey = `service-backups/${serviceId}/${backupId}.${backupResult.extension}`;

    // Pipe the strategy's output stream through a byte counter into storage
    let bytesReceived = 0;
    const counter = new PassThrough();
    counter.on("data", (chunk: Buffer) => {
      bytesReceived += chunk.length;
    });

    await deps.storage.uploadStream(storageKey, backupResult.stream.pipe(counter));

    await db.serviceBackup.update({
      where: { id: backupId },
      data: {
        status: "COMPLETED",
        path: storageKey,
        size: BigInt(bytesReceived),
        metadata: toPrismaJson(backupResult.metadata) ?? {},
        completedAt: new Date(),
      },
    });

    // Restore previous service status
    await db.service.update({
      where: { id: serviceId },
      data: { status: previousStatus as "RUNNING" | "HEALTHY" | "UNHEALTHY" | "STOPPED" | "ERROR" },
    });

    await emitServiceStatus(context, previousStatus);

    // Apply retention policy
    await applyRetentionPolicy(db, serviceId, deps.storage);

    await context.updateProgress({
      type: "service.backup-completed",
      serviceId,
      backupId,
    });

    logger.info("Backup completed", {
      serviceId,
      backupId,
      size: bytesReceived,
      storageKey,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await db.serviceBackup.update({
      where: { id: backupId },
      data: {
        status: "FAILED",
        error: errorMessage,
        completedAt: new Date(),
      },
    });

    // Restore previous service status on failure
    await db.service.update({
      where: { id: serviceId },
      data: { status: previousStatus as "RUNNING" | "HEALTHY" | "UNHEALTHY" | "STOPPED" | "ERROR" },
    });

    await emitServiceStatus(context, previousStatus);

    await context.updateProgress({
      type: "service.backup-failed",
      serviceId,
      backupId,
      error: errorMessage,
    });

    logger.error("Backup failed", { serviceId, backupId, error: errorMessage });
    throw err;
  }
}

async function applyRetentionPolicy(
  db: Awaited<ReturnType<typeof getDatabaseClient>>,
  serviceId: string,
  storage: LocalStorageProvider
): Promise<void> {
  const service = await db.service.findUnique({ where: { id: serviceId } });
  if (!service?.autoBackupRetention) return;

  const backups = await db.serviceBackup.findMany({
    where: {
      serviceId,
      status: "COMPLETED",
      type: { not: "MANUAL" },
    },
    orderBy: { createdAt: "desc" },
  });

  const excess = backups.slice(service.autoBackupRetention);
  for (const backup of excess) {
    if (backup.path) {
      await storage.delete(backup.path).catch(() => {});
    }
    await db.serviceBackup.delete({ where: { id: backup.id } });
    logger.info("Deleted expired backup per retention policy", {
      backupId: backup.id,
      serviceId,
    });
  }
}
