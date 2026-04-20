import type { IJobContext } from "@forge/queue";
import type { IContainerRuntime } from "@forge/docker";
import type { ServiceJobData } from "@forge/service-catalog";
import { engineRegistry, backupStrategyRegistry, resolveImageRef } from "@forge/service-catalog";
import { getDatabaseClient } from "@forge/database";
import { LoggerService } from "@forge/logger";
import type { LogLevel, ServiceBackup } from "@forge/types";
import { emitServiceStatus } from "../utils/emit-status.js";
import { toDockerHealthCheck } from "../service-provisioner.js";

const logger = new LoggerService({
  level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
  enabled: true,
  name: "upgrade-handler",
});

interface UpgradeHandlerContext {
  runtime: IContainerRuntime;
}

export async function handleUpgrade(
  context: IJobContext<ServiceJobData>,
  deps: UpgradeHandlerContext
): Promise<void> {
  const { serviceId, projectId, targetVersion } = context.job.data;

  if (!targetVersion) {
    throw new Error("Target version is required for upgrade");
  }

  const db = getDatabaseClient();

  const service = await db.service.findUnique({
    where: { id: serviceId },
    include: { projectAccess: true },
  });
  if (!service) {
    throw new Error(`Service ${serviceId} not found`);
  }

  if (!service.engine) {
    throw new Error(`Service ${serviceId} has no engine specified`);
  }

  if (!service.containerId) {
    throw new Error(`Service ${serviceId} has no container — cannot upgrade`);
  }

  const engineDef = engineRegistry.get(service.engine);
  const currentVersion = service.version ?? engineDef.defaultVersion;

  if (currentVersion === targetVersion) {
    throw new Error(`Service is already at version ${targetVersion}`);
  }

  const targetEngineVersion = engineRegistry.validateVersion(service.engine, targetVersion);
  if (targetEngineVersion.deprecated) {
    logger.warn("Target version is deprecated", {
      serviceId,
      engine: service.engine,
      targetVersion,
    });
  }

  const containerName = `forge-svc-${serviceId.substring(0, 8)}`;
  const backupContainerName = `${containerName}-old`;

  logger.info("Starting service upgrade", {
    serviceId,
    engine: service.engine,
    from: currentVersion,
    to: targetVersion,
  });

  try {
    // Step 1: Trigger pre-upgrade backup
    await context.updateProgress({
      type: "service:upgrade-progress",
      serviceId,
      stage: "pre-upgrade-backup",
      message: "Creating pre-upgrade backup...",
    });

    const backup = await createPreUpgradeBackup(db, serviceId);

    // Wait for the backup to be available (give it a moment to be picked up by the scheduler)
    // We use a direct inline backup rather than enqueuing to avoid async coordination issues
    const backupStrategy = backupStrategyRegistry.get(service.engine);
    if (backupStrategy.supported && service.containerId) {
      try {
        await db.serviceBackup.update({
          where: { id: backup.id },
          data: { status: "IN_PROGRESS", startedAt: new Date() },
        });

        await db.service.update({
          where: { id: serviceId },
          data: { status: "UPGRADING" },
        });

        const backupResult = await backupStrategy.runBackup({
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
          backupId: backup.id,
        });

        const PassThrough = (await import("node:stream")).PassThrough;
        const LocalStorageProvider = (await import("@forge/storage")).LocalStorageProvider;
        const path = await import("node:path");
        const os = await import("node:os");

        const storagePath =
          process.env.BACKUP_STORAGE_PATH ?? path.join(os.homedir(), ".forge", "backups");
        const storage = new LocalStorageProvider(storagePath);

        let bytesReceived = 0;
        const counter = new PassThrough();
        counter.on("data", (chunk: Buffer) => {
          bytesReceived += chunk.length;
        });

        const storageKey = `service-backups/${serviceId}/${backup.id}.${backupResult.extension}`;
        await storage.uploadStream(storageKey, backupResult.stream.pipe(counter));

        await db.serviceBackup.update({
          where: { id: backup.id },
          data: {
            status: "COMPLETED",
            path: storageKey,
            size: BigInt(bytesReceived),
            completedAt: new Date(),
          },
        });

        logger.info("Pre-upgrade backup completed", {
          serviceId,
          backupId: backup.id,
          size: bytesReceived,
        });
      } catch (backupErr) {
        const backupError = backupErr instanceof Error ? backupErr.message : String(backupErr);
        logger.warn("Pre-upgrade backup failed — proceeding with upgrade", {
          serviceId,
          error: backupError,
        });
        await db.serviceBackup.update({
          where: { id: backup.id },
          data: { status: "FAILED", error: backupError, completedAt: new Date() },
        });
      }
    }

    await emitServiceStatus(context, "UPGRADING");

    // Step 2: Stop the current container
    await context.updateProgress({
      type: "service:upgrade-progress",
      serviceId,
      stage: "stopping-current",
      message: "Stopping current container...",
    });

    try {
      await deps.runtime.stop(service.containerId, { timeout: 30 });
    } catch {
      // Container may already be stopped
    }

    // Step 3: Rename current container to backup name
    await context.updateProgress({
      type: "service:upgrade-progress",
      serviceId,
      stage: "renaming-container",
      message: "Renaming current container as fallback...",
    });

    try {
      await deps.runtime.rename(service.containerId, backupContainerName);
    } catch {
      // Rename may fail if container already has the target name — continue
      logger.warn("Could not rename container for backup", {
        containerId: service.containerId,
        targetName: backupContainerName,
      });
    }

    // Step 4: Create new container with upgraded image
    await context.updateProgress({
      type: "service:upgrade-progress",
      serviceId,
      stage: "creating-new-container",
      message: `Creating new container with version ${targetVersion}...`,
    });

    const fullImage = resolveImageRef(engineDef, targetEngineVersion);

    await deps.runtime.pullImage(fullImage);

    // Build env vars from service record
    const params = {
      name: service.name,
      version: targetVersion,
      username: service.connectionUsername ?? "admin",
      password: service.connectionPassword ?? "",
      database: service.connectionDatabase ?? "db",
      configOverrides: (service.config as Record<string, string>) ?? {},
    };

    const engineEnv = engineDef.defaultEnv(params);
    for (const param of engineDef.configParameters) {
      const override = params.configOverrides[param.key];
      if (override !== undefined) {
        engineEnv[param.envMapping] = override;
      } else {
        engineEnv[param.envMapping] = param.defaultValue;
      }
    }

    let healthCheck = engineDef.healthCheck(params);
    if (service.engine === "redis" && service.connectionPassword) {
      healthCheck = {
        ...healthCheck,
        test: ["CMD", "redis-cli", "-a", service.connectionPassword, "ping"],
      };
    }

    // Resolve networks
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const { generateNetworkName } = await import("@forge/docker");
    const networkName = generateNetworkName(projectId, project.name);
    const hostname = containerName;

    const networks = [{ name: networkName, aliases: [hostname] }];

    // Include shared service project networks
    for (const access of service.projectAccess) {
      const targetProject = await db.project.findUnique({
        where: { id: access.projectId },
        select: { name: true },
      });
      if (!targetProject) continue;
      const targetNetworkName = generateNetworkName(access.projectId, targetProject.name);
      networks.push({ name: targetNetworkName, aliases: [hostname] });
    }

    const volumes = [];
    if (engineDef.dataPath && service.volumeName) {
      volumes.push({
        source: service.volumeName,
        target: engineDef.dataPath,
        readOnly: false,
      });
    }

    const dockerHealthCheck = toDockerHealthCheck(healthCheck);

    const cmd =
      service.engine === "minio" ? ["server", "/data", "--console-address", ":9001"] : undefined;

    const resourceDefaults = engineDef.resourceDefaults;
    const resourceOverrides = (service.config as Record<string, unknown>)?.resources as
      | { memoryMB?: number; cpuShares?: number }
      | undefined;
    const resources = resolveUpgradeResources(resourceDefaults, resourceOverrides);

    const container = await deps.runtime.create({
      name: containerName,
      image: fullImage,
      cmd,
      env: engineEnv,
      labels: {
        "forge.managed": "true",
        "forge.service": "true",
        "forge.serviceId": serviceId,
        "forge.projectId": projectId,
        "forge.engine": service.engine,
        "forge.serviceType": engineDef.type,
      },
      volumes,
      networks,
      healthCheck: dockerHealthCheck,
      restartPolicy: { name: "unless-stopped" },
      resources,
    });

    // Step 5: Start and wait for health
    await context.updateProgress({
      type: "service:upgrade-progress",
      serviceId,
      stage: "starting-new-container",
      message: "Starting new container and waiting for health check...",
    });

    await deps.runtime.start(container.id);

    const healthTimeout =
      service.engine === "elasticsearch" || service.engine === "prometheus" ? 180_000 : 120_000;

    await deps.runtime.waitForHealthy(container.id, { timeout: healthTimeout });

    // Step 6: Success — clean up old container
    await context.updateProgress({
      type: "service:upgrade-progress",
      serviceId,
      stage: "cleanup",
      message: "Upgrade successful — cleaning up old container...",
    });

    try {
      await deps.runtime.remove(backupContainerName, { force: true });
    } catch {
      // Old container may have already been removed
    }

    await db.service.update({
      where: { id: serviceId },
      data: {
        status: "RUNNING",
        version: targetVersion,
        containerId: container.id,
      },
    });

    await emitServiceStatus(context, "RUNNING");

    await context.updateProgress({
      type: "service:upgrade-completed",
      serviceId,
      previousVersion: currentVersion,
      newVersion: targetVersion,
      backupId: backup.id,
    });

    logger.info("Service upgrade completed", {
      serviceId,
      from: currentVersion,
      to: targetVersion,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    logger.error("Service upgrade failed — rolling back", {
      serviceId,
      error: errorMessage,
    });

    // Rollback: remove new container if it was created, restore old container
    try {
      // Try to remove the new container
      try {
        await deps.runtime.stop(containerName, { timeout: 10 });
      } catch {
        // Container may have already been stopped
      }
      try {
        await deps.runtime.remove(containerName, { force: true });
      } catch {
        // Container may have already been removed
      }

      // Rename old container back
      try {
        await deps.runtime.rename(backupContainerName, containerName);
        await deps.runtime.start(containerName);
        await deps.runtime.waitForHealthy(containerName, { timeout: 60_000 });
      } catch (rollbackErr) {
        logger.error("Rollback failed", {
          serviceId,
          error: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
        });
      }
    } catch (rollbackErr) {
      logger.error("Rollback cleanup failed", {
        serviceId,
        error: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
      });
    }

    await db.service.update({
      where: { id: serviceId },
      data: { status: "ERROR" },
    });

    await emitServiceStatus(context, "ERROR");

    await context.updateProgress({
      type: "service:upgrade-failed",
      serviceId,
      error: errorMessage,
    });

    throw err;
  }
}

async function createPreUpgradeBackup(
  db: Awaited<ReturnType<typeof getDatabaseClient>>,
  serviceId: string
): Promise<ServiceBackup> {
  return db.serviceBackup.create({
    data: {
      serviceId,
      type: "PRE_UPGRADE",
      path: "",
      size: BigInt(0),
      status: "PENDING",
    },
  });
}

function resolveUpgradeResources(
  engineDefaults: { memoryMB: number; memoryReservationMB: number; cpuShares: number },
  overrides?: { memoryMB?: number; cpuShares?: number } | null
): {
  memory: string;
  memoryReservation: string;
  cpuShares: number;
} {
  const MAX_MEMORY_MB = 4096;
  const MAX_CPU_SHARES = 2048;

  let memoryMB = engineDefaults.memoryMB;
  let cpuShares = engineDefaults.cpuShares;

  if (overrides) {
    if (overrides.memoryMB !== undefined) {
      if (overrides.memoryMB < engineDefaults.memoryReservationMB) {
        throw new Error(
          `Requested memory ${overrides.memoryMB}MB is below the engine minimum reservation of ${engineDefaults.memoryReservationMB}MB`
        );
      }
      if (overrides.memoryMB > MAX_MEMORY_MB) {
        throw new Error(
          `Requested memory ${overrides.memoryMB}MB exceeds the platform maximum of ${MAX_MEMORY_MB}MB`
        );
      }
      memoryMB = overrides.memoryMB;
    }
    if (overrides.cpuShares !== undefined) {
      if (overrides.cpuShares < 1 || overrides.cpuShares > MAX_CPU_SHARES) {
        throw new Error(`CPU shares must be between 1 and ${MAX_CPU_SHARES}`);
      }
      cpuShares = overrides.cpuShares;
    }
  }

  return {
    memory: `${memoryMB}m`,
    memoryReservation: `${engineDefaults.memoryReservationMB}m`,
    cpuShares,
  };
}
