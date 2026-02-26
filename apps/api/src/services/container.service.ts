/**
 * ContainerService - Business logic layer for container management
 *
 * Responsibilities:
 * - Create Docker containers via DockerRuntime
 * - Sync state between Docker and database
 * - Manage container lifecycle (start/stop/restart/remove)
 * - Handle network/volume creation via managers
 *
 * Two creation pathways:
 * - Deployment-driven: Containers created as part of deployment (future)
 * - Direct API: Manual container creation for debugging/management
 */

import {
  type DockerContainer,
  type DockerContainerStatus,
  type ContainerStats,
  type LogOptions,
  type ExecOptions,
  type ExecResult,
  type VolumeMount,
  toPrismaJson,
} from "@forge/types";
import type {
  Container,
  PortMapping as DbPortMapping,
  VolumeMapping as DbVolumeMapping,
  HealthCheckConfig as DbHealthCheckConfig,
  NetworkAttachment,
  ResourceLimit as DbResourceLimit,
  PrismaClient,
  ContainerStatus,
} from "@forge/database";
import type { IContainerService, ContainerCreateConfig } from "@forge/core";
import type { DockerRuntime } from "@forge/docker";
import { NetworkManager } from "./network-manager";
import { VolumeManager } from "./volume-manager";

/**
 * Maps Docker container status to database ContainerStatus
 */
function mapDockerStatusToDb(status: DockerContainerStatus): ContainerStatus {
  const statusMap: Record<DockerContainerStatus, ContainerStatus> = {
    created: "CREATING",
    running: "RUNNING",
    paused: "STOPPED",
    restarting: "RESTARTING",
    removing: "STOPPING",
    exited: "STOPPED",
    dead: "TERMINATED",
  };
  return statusMap[status] ?? "ERROR";
}

/**
 * Generate a container name for a project and deployment
 */
function generateContainerName(
  projectName: string,
  deploymentId: string,
  containerNumber: number = 1
): string {
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .substring(0, 30);
  const shortId = deploymentId.substring(0, 8);
  return `${slug}-${shortId}-${containerNumber}`;
}

/**
 * Parse memory string to bytes (e.g., "512m" -> 536870912)
 */
function parseMemoryToBytes(memory?: string): bigint | undefined {
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

export class ContainerService implements IContainerService {
  constructor(
    private readonly db: PrismaClient,
    private readonly runtime: DockerRuntime,
    private readonly networkManager: NetworkManager,
    private readonly volumeManager: VolumeManager
  ) {}

  /**
   * Creates a new container
   * Ensures network and volumes exist, creates Docker container, saves to database
   */
  async create(config: ContainerCreateConfig): Promise<DockerContainer> {
    const project = await this.db.project.findUnique({
      where: { id: config.projectId },
      select: { name: true },
    });

    if (!project) {
      throw new Error(`Project with ID ${config.projectId} not found`);
    }

    const deployment = await this.db.deployment.findUnique({
      where: { id: config.deploymentId },
    });

    if (!deployment) {
      throw new Error(`Deployment with ID ${config.deploymentId} not found`);
    }

    const networkName =
      config.networkName ?? (await this.networkManager.ensureProjectNetwork(config.projectId));

    const volumeMap = await this.volumeManager.ensureVolumes(
      config.volumes ?? [],
      config.projectId
    );

    const volumeMounts: VolumeMount[] = (config.volumes ?? []).map((v) => ({
      source: v.hostPath ?? volumeMap.get(v.mountPath)!,
      target: v.mountPath,
      readOnly: v.mode === "RO",
    }));

    const containerName = config.name ?? generateContainerName(project.name, config.deploymentId);

    const labels: Record<string, string> = {
      "forge.managed": "true",
      "forge.projectId": config.projectId,
      "forge.deploymentId": config.deploymentId,
      "forge.type": "deployment-container",
      ...(config.cmd ? { "forge.cmd": JSON.stringify(config.cmd) } : {}),
    };

    const dockerContainer = await this.runtime.create({
      name: containerName,
      image: config.image,
      cmd: config.cmd,
      entrypoint: config.entrypoint,
      env: config.env,
      labels,
      ports: config.ports,
      volumes: volumeMounts,
      network: networkName,
      networkAliases: config.networkAliases,
      workingDir: config.workingDir,
      user: config.user,
      resources: config.resources,
      healthCheck: config.healthCheck,
      restartPolicy: config.restartPolicy,
      autoRemove: config.autoRemove,
    });

    const container = await this.createDatabaseRecords(dockerContainer, config, networkName);

    return {
      ...dockerContainer,
      id: container.id,
      containerId: dockerContainer.id,
    } as DockerContainer;
  }

  /**
   * Starts a container
   */
  async start(id: string): Promise<void> {
    const container = await this.db.container.findUnique({
      where: { id },
    });

    if (!container) {
      throw new Error(`Container with ID ${id} not found`);
    }

    await this.runtime.start(container.containerId);

    await this.db.container.update({
      where: { id },
      data: {
        status: "STARTING",
        startedAt: new Date(),
      },
    });
  }

  /**
   * Stops a container with optional timeout
   */
  async stop(id: string, timeout?: number): Promise<void> {
    const container = await this.db.container.findUnique({
      where: { id },
    });

    if (!container) {
      throw new Error(`Container with ID ${id} not found`);
    }

    await this.runtime.stop(container.containerId, { timeout });

    await this.db.container.update({
      where: { id },
      data: {
        status: "STOPPING",
        stoppedAt: new Date(),
      },
    });
  }

  /**
   * Restarts a container
   */
  async restart(id: string): Promise<void> {
    const container = await this.db.container.findUnique({
      where: { id },
    });

    if (!container) {
      throw new Error(`Container with ID ${id} not found`);
    }

    await this.runtime.restart(container.containerId);

    await this.db.container.update({
      where: { id },
      data: {
        status: "RESTARTING",
        startedAt: new Date(),
      },
    });
  }

  /**
   * Removes a container
   */
  async remove(id: string, force?: boolean): Promise<void> {
    const container = await this.db.container.findUnique({
      where: { id },
    });

    if (!container) {
      throw new Error(`Container with ID ${id} not found`);
    }

    await this.runtime.remove(container.containerId, { force, volumes: false });

    await this.db.container.update({
      where: { id },
      data: {
        status: "TERMINATED",
        stoppedAt: new Date(),
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Gets a container by database ID
   */
  async getById(id: string): Promise<DockerContainer | null> {
    const container = await this.db.container.findUnique({
      where: { id },
      include: {
        ports: true,
        volumes: true,
        healthCheckConfig: true,
        networkAttachments: true,
        resourceLimit: true,
      },
    });

    if (!container) {
      return null;
    }

    const dockerInfo = await this.runtime.inspect(container.containerId);

    return this.mapToDockerContainer(container, dockerInfo);
  }

  /**
   * Gets all containers for a project
   */
  async getByProject(projectId: string): Promise<DockerContainer[]> {
    const containers = await this.db.container.findMany({
      where: {
        projectId,
        deletedAt: null,
      },
      include: {
        ports: true,
        volumes: true,
        healthCheckConfig: true,
        networkAttachments: true,
        resourceLimit: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const results: DockerContainer[] = [];

    for (const container of containers) {
      try {
        const dockerInfo = await this.runtime.inspect(container.containerId);
        results.push(this.mapToDockerContainer(container, dockerInfo));
      } catch {
        // Container might not exist in Docker anymore
        results.push(
          this.mapToDockerContainer(container, {
            id: container.containerId,
            name: container.name ?? container.containerId,
            image: container.image,
            status: "dead",
            state: {
              status: "dead",
              running: false,
              paused: false,
              restarting: false,
              oomKilled: false,
              dead: true,
              pid: 0,
              exitCode: -1,
              error: "Container not found in Docker",
            },
            created: container.createdAt,
            config: {
              hostname: "",
              env: [],
              labels: {},
            },
            networkSettings: {
              ipAddress: "",
              ports: {},
              networks: {},
            },
            mounts: [],
          })
        );
      }
    }

    return results;
  }

  /**
   * Gets all containers for a deployment
   */
  async getByDeployment(deploymentId: string): Promise<DockerContainer[]> {
    const containers = await this.db.container.findMany({
      where: {
        deploymentId,
        deletedAt: null,
      },
      include: {
        ports: true,
        volumes: true,
        healthCheckConfig: true,
        networkAttachments: true,
        resourceLimit: true,
      },
      orderBy: {
        containerNumber: "asc",
      },
    });

    const results: DockerContainer[] = [];

    for (const container of containers) {
      try {
        const dockerInfo = await this.runtime.inspect(container.containerId);
        results.push(this.mapToDockerContainer(container, dockerInfo));
      } catch {
        // Container might not exist in Docker anymore
        results.push(
          this.mapToDockerContainer(container, {
            id: container.containerId,
            name: container.name ?? container.containerId,
            image: container.image,
            status: "dead",
            state: {
              status: "dead",
              running: false,
              paused: false,
              restarting: false,
              oomKilled: false,
              dead: true,
              pid: 0,
              exitCode: -1,
              error: "Container not found in Docker",
            },
            created: container.createdAt,
            config: {
              hostname: "",
              env: [],
              labels: {},
            },
            networkSettings: {
              ipAddress: "",
              ports: {},
              networks: {},
            },
            mounts: [],
          })
        );
      }
    }

    return results;
  }

  /**
   * Gets logs from a container
   */
  async getLogs(id: string, options?: LogOptions): Promise<string[]> {
    const container = await this.db.container.findUnique({
      where: { id },
    });

    if (!container) {
      throw new Error(`Container with ID ${id} not found`);
    }

    const logs: string[] = [];
    for await (const entry of this.runtime.logs(container.containerId, options)) {
      logs.push(`[${entry.timestamp.toISOString()}] ${entry.stream}: ${entry.message}`);
    }

    return logs;
  }

  /**
   * Gets stats from a container
   */
  async getStats(id: string): Promise<ContainerStats> {
    const container = await this.db.container.findUnique({
      where: { id },
    });

    if (!container) {
      throw new Error(`Container with ID ${id} not found`);
    }

    return await this.runtime.stats(container.containerId);
  }

  /**
   * Executes a command in a container
   */
  async exec(id: string, command: string[], options?: ExecOptions): Promise<ExecResult> {
    const container = await this.db.container.findUnique({
      where: { id },
    });

    if (!container) {
      throw new Error(`Container with ID ${id} not found`);
    }

    return await this.runtime.exec(container.containerId, command, options);
  }

  /**
   * Syncs Docker container state with database
   */
  async syncContainer(dockerContainerId: string): Promise<void> {
    const container = await this.db.container.findUnique({
      where: { containerId: dockerContainerId },
    });

    if (!container) {
      return;
    }

    try {
      const dockerInfo = await this.runtime.inspect(dockerContainerId);
      const newStatus = mapDockerStatusToDb(dockerInfo.state.status);

      if (newStatus !== container.status) {
        await this.db.container.update({
          where: { id: container.id },
          data: {
            status: newStatus,
            startedAt: dockerInfo.state.startedAt
              ? new Date(dockerInfo.state.startedAt)
              : undefined,
            stoppedAt: dockerInfo.state.finishedAt
              ? new Date(dockerInfo.state.finishedAt)
              : undefined,
          },
        });
      }
    } catch {
      await this.db.container.update({
        where: { id: container.id },
        data: {
          status: "TERMINATED",
          stoppedAt: new Date(),
        },
      });
    }
  }

  /**
   * Creates database records for a container
   */
  private async createDatabaseRecords(
    dockerContainer: DockerContainer,
    config: ContainerCreateConfig,
    networkName: string
  ): Promise<Container> {
    return await this.db.$transaction(async (tx) => {
      const container = await tx.container.create({
        data: {
          projectId: config.projectId,
          deploymentId: config.deploymentId,
          name: dockerContainer.name,
          containerId: dockerContainer.id,
          image: config.image,
          status: "CREATING",
          config: toPrismaJson(config),
          env: config.env,
        },
      });

      if (config.ports && config.ports.length > 0) {
        await tx.portMapping.createMany({
          data: config.ports.map((port) => ({
            containerId: container.id,
            containerPort: port.containerPort,
            hostPort: port.hostPort,
            protocol: (port.protocol?.toUpperCase() as "TCP" | "UDP") ?? "TCP",
          })),
        });
      }

      if (config.volumes && config.volumes.length > 0) {
        await tx.volumeMapping.createMany({
          data: config.volumes
            .filter((v) => !v.hostPath)
            .map((volume) => {
              const volumeName = this.volumeManager.generateVolumeName(
                config.projectId,
                volume.mountPath,
                undefined,
                volume.volumeName
              );
              return {
                containerId: container.id,
                source: volumeName,
                target: volume.mountPath,
                mode: volume.mode,
              };
            }),
        });
      }

      if (config.healthCheck) {
        await tx.healthCheckConfig.create({
          data: {
            containerId: container.id,
            test: JSON.stringify(config.healthCheck.test),
            interval: this.parseTimeToInt(config.healthCheck.interval) ?? 30,
            timeout: this.parseTimeToInt(config.healthCheck.timeout) ?? 5,
            retries: config.healthCheck.retries ?? 3,
            startPeriod: this.parseTimeToInt(config.healthCheck.startPeriod) ?? 0,
          },
        });
      }

      await tx.networkAttachment.create({
        data: {
          containerId: container.id,
          networkName,
        },
      });

      if (config.resources) {
        await tx.resourceLimit.create({
          data: {
            containerId: container.id,
            cpuRequest: config.resources.cpus,
            cpuLimit: config.resources.cpus,
            memoryLimit: parseMemoryToBytes(config.resources.memory),
            memoryRequest: parseMemoryToBytes(config.resources.memorySwap),
          },
        });
      }

      return container;
    });
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
   * Maps database container and Docker info to DockerContainer type
   */
  private mapToDockerContainer(
    dbContainer: Container & {
      ports: DbPortMapping[];
      volumes: DbVolumeMapping[];
      healthCheckConfig?: DbHealthCheckConfig | null;
      networkAttachments: NetworkAttachment[];
      resourceLimit?: DbResourceLimit | null;
    },
    dockerInfo: {
      id: string;
      name: string;
      image: string;
      status: DockerContainerStatus;
      state: {
        status: DockerContainerStatus;
        running: boolean;
        paused: boolean;
        restarting: boolean;
        oomKilled: boolean;
        dead: boolean;
        pid: number;
        exitCode?: number;
        error?: string;
        startedAt?: Date;
        finishedAt?: Date;
      };
      created: Date;
      config: {
        hostname: string;
        env: string[];
        labels?: Record<string, string>;
        cmd?: string[];
        workingDir?: string;
      };
      networkSettings: {
        ipAddress: string;
        ports: Record<string, { hostIp: string; hostPort: string }[]>;
        networks: Record<string, unknown>;
      };
      mounts: Array<{
        type: string;
        source: string;
        destination: string;
        mode: string;
        rw: boolean;
      }>;
      health?: {
        status: "healthy" | "unhealthy" | "starting" | "none";
        failingStreak: number;
      };
    }
  ): DockerContainer {
    return {
      id: dbContainer.containerId,
      // containerId: dbContainer.containerId,
      name: dbContainer.name ?? dockerInfo.name,
      image: dbContainer.image,
      status: dockerInfo.status,
      state: dockerInfo.state,
      created: dockerInfo.created,
      labels: dockerInfo.config.labels ?? {},
    };
  }
}
