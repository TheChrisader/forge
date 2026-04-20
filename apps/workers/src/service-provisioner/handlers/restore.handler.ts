import type { IJobContext } from "@forge/queue";
import type { IContainerRuntime } from "@forge/docker";
import type { ServiceJobData } from "@forge/service-catalog";
import { backupStrategyRegistry } from "@forge/service-catalog";
import { getDatabaseClient } from "@forge/database";
import { LoggerService } from "@forge/logger";
import type { LogLevel } from "@forge/types";
import { LocalStorageProvider } from "@forge/storage";
import { emitServiceStatus } from "../utils/emit-status.js";

const logger = new LoggerService({
  level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
  enabled: true,
  name: "restore-handler",
});

interface RestoreHandlerContext {
  runtime: IContainerRuntime;
  storage: LocalStorageProvider;
}

export async function handleRestore(
  context: IJobContext<ServiceJobData>,
  deps: RestoreHandlerContext
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
    throw new Error(`Service ${serviceId} has no container — cannot restore`);
  }

  if (!service.engine) {
    throw new Error(`Service ${serviceId} has no engine — cannot backup`);
  }

  const backup = await db.serviceBackup.findUnique({ where: { id: backupId } });
  if (!backup) {
    throw new Error(`Backup record ${backupId} not found`);
  }

  if (backup.serviceId !== serviceId) {
    throw new Error(`Backup ${backupId} does not belong to service ${serviceId}`);
  }

  if (backup.status !== "COMPLETED") {
    throw new Error(`Backup ${backupId} is not in COMPLETED state (current: ${backup.status})`);
  }

  if (!backup.path) {
    throw new Error(`Backup ${backupId} has no storage path`);
  }

  const strategy = backupStrategyRegistry.get(service.engine);
  if (!strategy.supported) {
    throw new Error(`Engine "${service.engine}" does not support restore`);
  }

  // Set service status to RESTORING
  await db.service.update({
    where: { id: serviceId },
    data: { status: "RESTORING" },
  });

  await emitServiceStatus(context, "RESTORING");

  try {
    // Download backup data from storage
    const backupData = await deps.storage.download(backup.path);

    // Execute restore
    await strategy.runRestore({
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
      backupData,
      backupMetadata: (backup.metadata as Record<string, unknown>) ?? undefined,
    });

    // Wait for the container to become healthy after restore
    // Some strategies stop/restart the container (Redis, Elasticsearch, Prometheus)
    try {
      await deps.runtime.waitForHealthy(service.containerId, {
        timeout: 60_000,
        interval: 2_000,
      });
    } catch {
      logger.warn("Container did not become healthy within timeout after restore", {
        serviceId,
        containerId: service.containerId,
      });
      // Still proceed — mark as UNHEALTHY rather than failing the restore
      await db.service.update({
        where: { id: serviceId },
        data: { status: "UNHEALTHY" },
      });
      await emitServiceStatus(context, "UNHEALTHY");

      await context.updateProgress({
        type: "service:restored",
        serviceId,
        backupId,
        warning: "Container did not pass health check after restore",
      });

      return;
    }

    // Restore service to running status
    await db.service.update({
      where: { id: serviceId },
      data: { status: "HEALTHY" },
    });

    await emitServiceStatus(context, "HEALTHY");

    await context.updateProgress({
      type: "service:restored",
      serviceId,
      backupId,
    });

    logger.info("Restore completed", { serviceId, backupId });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await db.service.update({
      where: { id: serviceId },
      data: { status: "ERROR" },
    });

    await emitServiceStatus(context, "ERROR");

    await context.updateProgress({
      type: "service:restore-failed",
      serviceId,
      backupId,
      error: errorMessage,
    });

    logger.error("Restore failed", { serviceId, backupId, error: errorMessage });
    throw err;
  }
}
