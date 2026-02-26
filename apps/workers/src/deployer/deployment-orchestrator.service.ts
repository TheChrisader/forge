/**
 * Deployment Orchestrator Service
 *
 * Coordinates the full deployment lifecycle:
 * - Create container from built image
 * - Start container
 * - Wait for health check
 * - Update deployment status
 */

import pino from "pino";
import type { PrismaClient } from "@forge/database";
import type { DockerRuntime, VolumeMount as DockerVolumeMount } from "@forge/docker";
import type { DeploymentStatus, ContainerConfig, ContainerHealthCheckConfig } from "@forge/types";
import { toPrismaJson } from "@forge/types";

/**
 * Project configuration from Project.config (JSON field in database)
 */
interface ProjectConfig {
  port?: number;
  env?: Record<string, string>;
  startCommand?: string;
  entrypoint?: string[];
  workingDir?: string;
  user?: string;
  volumes?: ProjectVolumeConfig[];
  resources?: ProjectResourceConfig;
  healthCheck?: ContainerHealthCheckConfig;
  restartPolicy?: "no" | "always" | "on-failure" | "unless-stopped";
  restartRetries?: number;
  autoRemove?: boolean;
}

/**
 * Volume configuration from Project.config.volumes
 * This is how volumes are defined in the project config (user-facing)
 */
interface ProjectVolumeConfig {
  mountPath: string;
  hostPath?: string; // If present, it's a bind mount, not a named volume
  volumeName?: string; // Custom name for the volume
  mode?: "RW" | "RO";
}

/**
 * Resource limits configuration from Project.config.resources
 */
interface ProjectResourceConfig {
  memory?: string;
  memorySwap?: string;
  cpus?: number;
  cpuShares?: number;
}

/**
 * Deployment data returned from Prisma query
 */
interface DeploymentData {
  id: string;
  version: number;
}

/**
 * Project data returned from Prisma query
 */
interface ProjectData {
  id: string;
  name: string;
  config: ProjectConfig;
}

/**
 * Internal container configuration that uses project-specific volume types
 * This is converted to Docker's VolumeMount format before calling runtime
 */
interface InternalContainerConfig extends Omit<ContainerConfig, "volumes"> {
  volumes: ProjectVolumeConfig[];
}

interface DeployOptions {
  healthCheckTimeout?: number;
}

export class DeploymentOrchestrator {
  constructor(
    private readonly db: PrismaClient,
    private readonly runtime: DockerRuntime,
    private readonly logger: pino.Logger
  ) {}

  /**
   * Orchestrates the full deployment lifecycle:
   * 1. Create container from built image
   * 2. Start container
   * 3. Wait for health check
   * 4. Update deployment status
   */
  async deploy(deploymentId: string, image: string, options?: DeployOptions): Promise<void> {
    this.logger.info({ deploymentId, image }, "Starting deployment orchestration");

    const deployment = await this.db.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        project: {
          select: { id: true, name: true, config: true },
        },
      },
    });

    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    const project = deployment.project as ProjectData;

    await this.db.deployment.update({
      where: { id: deploymentId },
      data: {
        status: "DEPLOYING" as DeploymentStatus,
        deployStartedAt: new Date(),
        buildImage: image,
      },
    });

    this.logger.info({ deploymentId, image }, "Creating container");
    const container = await this.createContainer(deployment as DeploymentData, project, image);

    this.logger.info({ deploymentId, containerId: container.containerId }, "Starting container");
    await this.runtime.start(container.containerId);

    await this.db.container.update({
      where: { id: container.id },
      data: { status: "STARTING", startedAt: new Date() },
    });

    const healthCheckTimeout = options?.healthCheckTimeout ?? 120_000;
    const healthy = await this.waitForHealthy(container.containerId, healthCheckTimeout);

    if (healthy) {
      await this.db.deployment.update({
        where: { id: deploymentId },
        data: {
          status: "RUNNING" as DeploymentStatus,
          deployCompletedAt: new Date(),
        },
      });

      await this.db.project.update({
        where: { id: project.id },
        data: { status: "ACTIVE" },
      });

      await this.db.container.update({
        where: { id: container.id },
        data: { status: "HEALTHY", healthStatus: "HEALTHY" },
      });

      this.logger.info(
        { deploymentId, containerId: container.containerId },
        "Deployment completed successfully"
      );
    } else {
      await this.handleFailure(
        deploymentId,
        container.containerId,
        "Container failed health check"
      );
    }
  }

  /**
   * Creates a container and its database records
   */
  private async createContainer(
    deployment: DeploymentData,
    project: ProjectData,
    image: string
  ): Promise<{ id: string; containerId: string }> {
    const containerConfig = this.buildContainerConfig(deployment, project, image);

    await this.ensureNetwork(project.id, project.name);

    const volumeMap = await this.ensureVolumes(containerConfig.volumes, project.id);

    const volumeMounts = this.convertToDockerVolumeMounts(containerConfig.volumes, volumeMap);

    const containerName = `${project.name
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")}-${deployment.id.substring(0, 8)}`;

    const networkName = `forge-project-${project.id}`;
    const dockerContainer = await this.runtime.create({
      ...containerConfig,
      volumes: volumeMounts,
      name: containerName,
      network: networkName,
      labels: {
        "forge.managed": "true",
        "forge.projectId": project.id,
        "forge.deploymentId": deployment.id,
        "forge.type": "deployment-container",
      },
    });

    const container = await this.createContainerDatabaseRecords(
      dockerContainer,
      deployment,
      project,
      containerConfig,
      containerName,
      networkName,
      image
    );

    return container;
  }

  /**
   * Converts ProjectVolumeConfig[] to Docker's VolumeMount[] format
   */
  private convertToDockerVolumeMounts(
    volumes: ProjectVolumeConfig[],
    volumeMap: Map<string, string>
  ): DockerVolumeMount[] {
    return volumes.map((v) => ({
      source: v.hostPath ?? volumeMap.get(v.mountPath)!,
      target: v.mountPath,
      readOnly: v.mode === "RO",
    }));
  }

  /**
   * Creates all database records for a container in a transaction
   */
  private async createContainerDatabaseRecords(
    dockerContainer: { id: string },
    deployment: DeploymentData,
    project: ProjectData,
    containerConfig: InternalContainerConfig,
    containerName: string,
    networkName: string,
    image: string
  ): Promise<{ id: string; containerId: string }> {
    return await this.db.$transaction(async (tx) => {
      const container = await tx.container.create({
        data: {
          projectId: project.id,
          deploymentId: deployment.id,
          name: containerName,
          containerId: dockerContainer.id,
          image: image,
          status: "CREATING",
          config: toPrismaJson(containerConfig),
          env: toPrismaJson(containerConfig.env),
        },
      });

      if (containerConfig.ports && containerConfig.ports.length > 0) {
        await tx.portMapping.createMany({
          data: containerConfig.ports.map((port) => ({
            containerId: container.id,
            containerPort: port.containerPort,
            hostPort: port.hostPort,
            protocol: (port.protocol?.toUpperCase() as "TCP" | "UDP") ?? "TCP",
          })),
        });
      }

      // Volume mappings (only for named volumes, not bind mounts)
      if (containerConfig.volumes && containerConfig.volumes.length > 0) {
        await tx.volumeMapping.createMany({
          data: containerConfig.volumes
            .filter((v) => !v.hostPath)
            .map((volume) => {
              const volumeName = this.generateVolumeName(
                project.id,
                volume.mountPath,
                volume.volumeName
              );
              return {
                containerId: container.id,
                source: volumeName,
                target: volume.mountPath,
                mode: volume.mode || "RW",
              };
            }),
        });
      }

      if (containerConfig.healthCheck) {
        await tx.healthCheckConfig.create({
          data: {
            containerId: container.id,
            test: JSON.stringify(containerConfig.healthCheck.test),
            interval: this.parseTimeToInt(containerConfig.healthCheck.interval) ?? 30,
            timeout: this.parseTimeToInt(containerConfig.healthCheck.timeout) ?? 5,
            retries: containerConfig.healthCheck.retries ?? 3,
            startPeriod: this.parseTimeToInt(containerConfig.healthCheck.startPeriod) ?? 0,
          },
        });
      }

      await tx.networkAttachment.create({
        data: {
          containerId: container.id,
          networkName,
        },
      });

      if (containerConfig.resources) {
        await tx.resourceLimit.create({
          data: {
            containerId: container.id,
            cpuRequest: containerConfig.resources.cpus,
            cpuLimit: containerConfig.resources.cpus,
            memoryLimit: this.parseMemoryToBytes(containerConfig.resources.memory),
            memoryRequest: this.parseMemoryToBytes(containerConfig.resources.memorySwap),
          },
        });
      }

      return { id: container.id, containerId: dockerContainer.id };
    });
  }

  /**
   * Ensures a project network exists, creates if missing
   */
  private async ensureNetwork(projectId: string, projectName: string): Promise<void> {
    const networkName = `forge-project-${projectId}`;

    const existingNetworks = await this.runtime.listNetworks({
      name: [networkName],
    });

    if (existingNetworks.length > 0) {
      return;
    }

    await this.runtime.createNetwork({
      name: networkName,
      driver: "bridge",
      internal: false,
      attachable: true,
      labels: {
        "forge.managed": "true",
        "forge.projectId": projectId,
        "forge.projectName": projectName,
        "forge.type": "project-network",
      },
    });

    this.logger.info({ networkName, projectName }, "Created project network");
  }

  /**
   * Ensures all volumes exist, creates if missing
   * Returns map of mount paths to volume names
   */
  private async ensureVolumes(
    volumes: ProjectVolumeConfig[],
    projectId: string
  ): Promise<Map<string, string>> {
    const volumeMap = new Map<string, string>();

    for (const volumeConfig of volumes) {
      if (volumeConfig.hostPath) {
        volumeMap.set(volumeConfig.mountPath, volumeConfig.hostPath);
        continue;
      }

      const volumeName = this.generateVolumeName(
        projectId,
        volumeConfig.mountPath,
        volumeConfig.volumeName
      );

      const existingVolumes = await this.runtime.listVolumes({
        name: [volumeName],
      });

      if (existingVolumes.length === 0) {
        await this.runtime.createVolume({
          name: volumeName,
          driver: "local",
          labels: {
            "forge.managed": "true",
            "forge.projectId": projectId,
            "forge.type": "project-volume",
          },
        });

        this.logger.info({ volumeName }, "Created volume");
      }

      volumeMap.set(volumeConfig.mountPath, volumeName);
    }

    return volumeMap;
  }

  /**
   * Generates a volume name
   */
  private generateVolumeName(projectId: string, mountPath: string, customName?: string): string {
    if (customName) {
      return customName;
    }

    const pathParts = mountPath.split("/").filter(Boolean);
    const pathSlug = pathParts.slice(-2).join("-");
    return `forge-volume-${pathSlug}-${projectId}`;
  }

  /**
   * Parses time string (e.g., "30s", "5m") to integer seconds
   */
  private parseTimeToInt(time?: string): number | undefined {
    if (!time) return undefined;
    const match = time.match(/^(\d+)(s|m|h)?$/);
    if (!match) return undefined;

    const value = parseInt(match[1], 10);
    const unit = match[2] || "s";

    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600 };
    return value * multipliers[unit];
  }

  /**
   * Parses memory string to bytes (e.g., "512m" -> 536870912)
   */
  private parseMemoryToBytes(memory?: string): bigint | undefined {
    if (!memory) return undefined;
    const match = memory.match(/^(\d+(?:\.\d+)?)(b|k|m|g)?$/i);
    if (!match) return undefined;

    const value = parseFloat(match[1]);
    const unit = (match[2] || "b").toLowerCase();

    const multipliers: Record<string, number> = {
      b: 1,
      k: 1024,
      m: 1024 * 1024,
      g: 1024 * 1024 * 1024,
    };

    return BigInt(Math.floor(value * multipliers[unit]));
  }

  /**
   * Builds container configuration from deployment and project
   */
  private buildContainerConfig(
    deployment: DeploymentData,
    project: ProjectData,
    image: string
  ): InternalContainerConfig {
    const config = project.config || {};

    const port = config.port || 3000;
    const env = config.env || {};

    return {
      image: image,
      cmd: config.startCommand ? config.startCommand.split(" ") : undefined,
      entrypoint: config.entrypoint,
      env: {
        NODE_ENV: "production",
        PORT: port.toString(),
        FORGE_PROJECT_ID: project.id,
        FORGE_DEPLOYMENT_ID: deployment.id,
        ...env,
      },
      ports: [
        {
          containerPort: port,
          protocol: "tcp",
          // hostPort auto-assigned by Docker
        },
      ],
      volumes: config.volumes || [],
      workingDir: config.workingDir,
      user: config.user,
      resources: config.resources
        ? {
            memory: config.resources.memory,
            memorySwap: config.resources.memorySwap,
            cpus: config.resources.cpus,
            cpuShares: config.resources.cpuShares,
          }
        : undefined,
      healthCheck: this.getHealthCheckConfig(project),
      restartPolicy: {
        name: (config.restartPolicy || "unless-stopped") as
          | "no"
          | "always"
          | "on-failure"
          | "unless-stopped",
        maximumRetryCount: config.restartRetries,
      },
      autoRemove: config.autoRemove || false,
    };
  }

  /**
   * Extracts health check config from Project.config
   * Derives sensible defaults if not specified
   */
  private getHealthCheckConfig(project: ProjectData): ContainerHealthCheckConfig | undefined {
    const config = project.config || {};

    if (config.healthCheck) {
      return config.healthCheck;
    }

    const port = config.port || 3000;
    return {
      test: ["CMD", "curl", "-f", `http://localhost:${port}/health`],
      interval: "10s",
      timeout: "5s",
      retries: 3,
      startPeriod: "30s",
    };
  }

  /**
   * Waits for container to become healthy
   */
  private async waitForHealthy(containerId: string, timeoutMs: number): Promise<boolean> {
    this.logger.info({ containerId, timeoutMs }, "Waiting for container to be healthy");

    try {
      await this.runtime.waitForHealthy(containerId, { timeout: timeoutMs });
      return true;
    } catch (error) {
      this.logger.warn({ containerId, error }, "Container health check failed");
      return false;
    }
  }

  /**
   * Handles deployment failure
   * Stops and removes container, updates deployment status
   */
  async handleFailure(
    deploymentId: string,
    containerId: string | null,
    error: string
  ): Promise<void> {
    this.logger.error({ deploymentId, containerId, error }, "Handling deployment failure");

    if (containerId) {
      try {
        await this.runtime.stop(containerId, { timeout: 10_000 });
        await this.runtime.remove(containerId, { force: true });
      } catch (err) {
        this.logger.warn({ containerId, err }, "Failed to cleanup container");
      }
    }

    await this.db.deployment.update({
      where: { id: deploymentId },
      data: {
        status: "FAILED",
        deployCompletedAt: new Date(),
        error,
      },
    });

    if (containerId) {
      await this.db.container.updateMany({
        where: { containerId },
        data: { status: "TERMINATED", healthStatus: "UNHEALTHY" },
      });
    }

    throw new Error(`Deployment failed: ${error}`);
  }
}
