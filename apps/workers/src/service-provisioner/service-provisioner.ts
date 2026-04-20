import type {
  IContainerRuntime,
  ContainerConfig,
  VolumeMount,
  NetworkAttachment,
  HealthCheckConfig as DockerHealthCheckConfig,
  ResourceLimits,
} from "@forge/docker";
import { generateNetworkName } from "@forge/docker";
import type { PrismaClient } from "@forge/database";
import type { Service } from "@forge/database";
import type { HealthCheckConfig } from "@forge/service-catalog";
import { engineRegistry, resolveImageRef } from "@forge/service-catalog";

export function toDockerHealthCheck(hc: HealthCheckConfig): DockerHealthCheckConfig {
  return {
    test: hc.test,
    interval: `${hc.interval / 1_000_000_000}s`,
    timeout: `${hc.timeout / 1_000_000_000}s`,
    retries: hc.retries,
    startPeriod: `${hc.startPeriod / 1_000_000_000}s`,
  };
}

const MAX_MEMORY_MB = 4096;
const MAX_CPU_SHARES = 2048;
const IMAGE_PULL_MAX_RETRIES = 3;

export class ServiceProvisioner {
  constructor(
    private readonly runtime: IContainerRuntime,
    private readonly db: PrismaClient
  ) {}

  private resolveResources(
    engineDefaults: { memoryMB: number; memoryReservationMB: number; cpuShares: number },
    overrides?: { memoryMB?: number; cpuShares?: number } | null
  ): ResourceLimits {
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

  async provision(service: Service): Promise<void> {
    const { id, projectId, engine } = service;

    if (!engine) {
      throw new Error(`Service ${id} has no engine specified`);
    }

    const engineDef = engineRegistry.get(engine);
    const version = service.version ?? engineDef.defaultVersion;
    const engineVersion = engineRegistry.validateVersion(engine, version);

    await this.db.service.update({
      where: { id },
      data: { status: "STARTING" },
    });

    const containerName = `forge-svc-${id.substring(0, 8)}`;
    const volumeName = `forge-svc-data-${id.substring(0, 8)}`;
    const hostname = containerName;

    const fullImage = resolveImageRef(engineDef, engineVersion);

    await this.pullImageWithRetry(fullImage);

    if (engineDef.dataPath) {
      await this.runtime.createVolume({
        name: volumeName,
        labels: {
          "forge.managed": "true",
          "forge.serviceId": id,
          "forge.projectId": projectId,
          "forge.engine": engine,
        },
      });
    }

    const params = {
      name: service.name,
      version,
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

    const volumes: VolumeMount[] = [];
    if (engineDef.dataPath) {
      volumes.push({
        source: volumeName,
        target: engineDef.dataPath,
        readOnly: false,
      });
    }

    let healthCheck = engineDef.healthCheck(params);

    // Inject actual password for Redis health check
    if (engine === "redis" && service.connectionPassword) {
      healthCheck = {
        ...healthCheck,
        test: ["CMD", "redis-cli", "-a", service.connectionPassword, "ping"],
      };
    }

    // Resolve project network
    const project = await this.db.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new Error(`Project ${projectId} not found for service ${id}`);
    }

    const networkName = generateNetworkName(projectId, project.name);

    const networks: NetworkAttachment[] = [{ name: networkName, aliases: [hostname] }];

    const cmd = engine === "minio" ? ["server", "/data", "--console-address", ":9001"] : undefined;

    const resourceOverrides = (service.config as Record<string, unknown>)?.resources as
      | { memoryMB?: number; cpuShares?: number }
      | undefined;
    const resources = this.resolveResources(engineDef.resourceDefaults, resourceOverrides);

    const containerConfig: ContainerConfig = {
      name: containerName,
      image: fullImage,
      cmd,
      env: engineEnv,
      labels: {
        "forge.managed": "true",
        "forge.service": "true",
        "forge.serviceId": id,
        "forge.projectId": projectId,
        "forge.engine": engine,
        "forge.serviceType": engineDef.type,
      },
      volumes,
      networks,
      healthCheck: toDockerHealthCheck(healthCheck),
      restartPolicy: {
        name: "unless-stopped",
      },
      resources,
    };

    const container = await this.runtime.create(containerConfig);
    await this.runtime.start(container.id);

    const healthTimeout = engine === "elasticsearch" || engine === "prometheus" ? 180_000 : 90_000;

    await this.runtime.waitForHealthy(container.id, { timeout: healthTimeout });

    const connectionUrl = engineDef.connectionUrl({
      hostname,
      port: engineDef.defaultPort,
      username: params.username,
      password: params.password,
      database: params.database,
    });

    await this.db.service.update({
      where: { id },
      data: {
        status: "RUNNING",
        connectionHost: hostname,
        connectionPort: engineDef.defaultPort,
        connectionUrl,
        internalHostname: hostname,
        volumeName,
        containerId: container.id,
      },
    });

    // If this is a shared service, attach to any project networks that were linked
    // while the service was still being provisioned (container didn't exist yet).
    if (service.isShared) {
      const links = await this.db.serviceProjectAccess.findMany({
        where: { serviceId: id },
        select: { projectId: true },
      });

      for (const link of links) {
        const targetProject = await this.db.project.findUnique({
          where: { id: link.projectId },
          select: { name: true },
        });
        if (!targetProject) continue;

        const targetNetworkName = generateNetworkName(link.projectId, targetProject.name);
        try {
          await this.runtime.connectNetwork(container.id, targetNetworkName, {
            aliases: [hostname],
          });
        } catch {
          // Best-effort — link networking can be retried by the API layer
        }
      }
    }
  }

  async deprovision(service: Service): Promise<void> {
    const { id, containerId, volumeName, projectId } = service;

    // 1. Mark incomplete backups as FAILED
    await this.db.serviceBackup.updateMany({
      where: { serviceId: id, status: { in: ["PENDING", "IN_PROGRESS"] } },
      data: { status: "FAILED", error: "Service deprovisioned" },
    });

    // 2. Stop and remove container
    if (containerId) {
      try {
        await this.runtime.stop(containerId, { timeout: 30 });
      } catch {
        // Container may already be stopped
      }

      try {
        await this.runtime.remove(containerId, { force: true });
      } catch {
        // Container may already be removed
      }
    }

    // 3. Detach from all project networks (shared services)
    try {
      const accessRecords = await this.db.serviceProjectAccess.findMany({
        where: { serviceId: id },
        select: { projectId: true },
      });

      for (const access of accessRecords) {
        if (containerId) {
          const targetProject = await this.db.project.findUnique({
            where: { id: access.projectId },
            select: { name: true },
          });
          if (targetProject) {
            const networkName = generateNetworkName(access.projectId, targetProject.name);
            try {
              await this.runtime.disconnectNetwork(containerId, networkName);
            } catch {
              // Network may already be disconnected or container removed
            }
          }
        }
      }
    } catch {
      // Best-effort network cleanup — don't block deprovision
    }

    // 4. Remove volume
    if (volumeName) {
      try {
        await this.runtime.removeVolume(volumeName);
      } catch {
        // Volume may already be removed
      }
    }

    // 5. Remove environment variable records associated with this service
    try {
      const sanitizedName = service.name.toUpperCase().replace(/[^A-Z0-9]/g, "_");
      await this.db.environmentVariable.deleteMany({
        where: {
          projectId,
          key: { startsWith: `${sanitizedName}_` },
        },
      });
    } catch {
      // Best-effort env var cleanup — don't block deprovision
    }

    // 6. Remove ServiceProjectAccess records (safety explicit delete before cascade)
    await this.db.serviceProjectAccess.deleteMany({ where: { serviceId: id } });

    // 7. Delete service record
    await this.db.service.delete({ where: { id } });
  }

  async start(service: Service): Promise<void> {
    const { id, containerId } = service;

    if (!containerId) {
      throw new Error(`Service ${id} has no container to start`);
    }

    await this.runtime.start(containerId);
    await this.runtime.waitForHealthy(containerId, { timeout: 90_000 });

    await this.db.service.update({
      where: { id },
      data: { status: "RUNNING" },
    });
  }

  async stop(service: Service): Promise<void> {
    const { id, containerId } = service;

    if (!containerId) {
      throw new Error(`Service ${id} has no container to stop`);
    }

    await this.db.service.update({
      where: { id },
      data: { status: "STOPPING" },
    });

    await this.runtime.stop(containerId, { timeout: 30 });

    await this.db.service.update({
      where: { id },
      data: { status: "STOPPED" },
    });
  }

  async restart(service: Service): Promise<void> {
    const { id, containerId } = service;

    if (!containerId) {
      throw new Error(`Service ${id} has no container to restart`);
    }

    await this.db.service.update({
      where: { id },
      data: { status: "STARTING" },
    });

    await this.runtime.restart(containerId);
    await this.runtime.waitForHealthy(containerId, { timeout: 90_000 });

    await this.db.service.update({
      where: { id },
      data: { status: "RUNNING" },
    });
  }

  private async pullImageWithRetry(image: string): Promise<void> {
    for (let attempt = 1; attempt <= IMAGE_PULL_MAX_RETRIES; attempt++) {
      try {
        await this.runtime.pullImage(image);
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        if (this.isDiskFullError(message)) {
          throw new Error(
            "Insufficient disk space to pull image. Free up disk space and try again."
          );
        }

        if (attempt === IMAGE_PULL_MAX_RETRIES) {
          throw new Error(
            `Failed to pull image ${image} after ${IMAGE_PULL_MAX_RETRIES} attempts: ${message}`
          );
        }

        const wait = Math.min(Math.pow(2, attempt) * 5000, 60_000);
        console.warn(
          `[service-provisioner] Image pull failed (attempt ${attempt}/${IMAGE_PULL_MAX_RETRIES}), retrying in ${wait / 1000}s: ${message}`
        );
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    }
  }

  private isDiskFullError(message: string): boolean {
    const lower = message.toLowerCase();
    return (
      lower.includes("no space left on device") ||
      lower.includes("disk quota exceeded") ||
      lower.includes("no space left")
    );
  }
}
