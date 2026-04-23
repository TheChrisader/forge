import type { ILogger } from "@forge/core";
import type { PrismaClient, Prisma } from "@forge/database";
import { DockerRuntime } from "@forge/docker";
import type {
  VolumeMount as DockerVolumeMount,
  RestartPolicy as DockerRestartPolicy,
} from "@forge/docker";
import { generateNetworkName } from "@forge/docker";
import type {
  ProjectConfig,
  ProjectVolumeConfig,
  ProjectHealthCheckConfig,
  ContainerConfig,
} from "@forge/types";
import { toPrismaJson } from "@forge/types";
import type { IProxyIntegration } from "@forge/proxy";

export interface DeploymentData {
  id: string;
}

export interface ProjectData {
  id: string;
  name: string;
  config: ProjectConfig;
}

export interface ManagedContainer {
  /** Database ID of the container record */
  id: string;
  /** Docker container ID */
  containerId: string;
}

export interface IContainerLifecycle {
  createContainer(
    deployment: DeploymentData,
    project: ProjectData,
    image: string,
    containerNumber?: number
  ): Promise<ManagedContainer>;

  startContainer(managedContainer: ManagedContainer): Promise<void>;

  waitForHealthy(containerId: string, timeoutMs: number): Promise<boolean>;

  stopAndRemove(containerId: string): Promise<void>;

  stopAndRemoveWithContext(
    containerId: string,
    projectId: string,
    deploymentId: string,
    projectName: string
  ): Promise<void>;

  ensureNetwork(projectId: string, projectName: string): Promise<string>;

  forceTerminateByDeployment(
    deploymentId: string,
    projectId: string,
    deploymentName: string
  ): Promise<void>;

  ensureVolumes(volumes: ProjectVolumeConfig[], projectId: string): Promise<Map<string, string>>;
}

/**
 * Internal container configuration that uses project-specific volume types.
 * This is converted to Docker's VolumeMount format before calling runtime.
 */
interface InternalContainerConfig extends Omit<ContainerConfig, "volumes"> {
  volumes: ProjectVolumeConfig[];
}

export class ContainerLifecycle implements IContainerLifecycle {
  constructor(
    private readonly db: PrismaClient,
    private readonly runtime: DockerRuntime,
    private readonly logger: ILogger,
    private readonly proxyIntegration: IProxyIntegration
  ) {}

  async createContainer(
    deployment: DeploymentData,
    project: ProjectData,
    image: string,
    containerNumber?: number
  ): Promise<ManagedContainer> {
    const containerConfig = this.buildContainerConfig(deployment, project, image);

    await this.ensureNetwork(project.id, project.name);

    const volumeMap = await this.ensureVolumes(containerConfig.volumes, project.id);
    const volumeMounts = this.convertToDockerVolumeMounts(containerConfig.volumes, volumeMap);

    const projectSlug = project.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    const networkName = generateNetworkName(project.id, project.name);

    let mergedLabels = containerConfig.labels || {};
    const networks: Array<{ name: string; aliases?: string[] }> = [{ name: networkName }];

    try {
      const proxyReqs = await this.proxyIntegration.prepareContainer({
        projectId: project.id,
        projectSlug,
        deploymentId: deployment.id,
        targetPort: this.getTargetPort(project),
        domains: [],
        networkName,
      });

      mergedLabels = { ...containerConfig.labels, ...proxyReqs.labels };
      networks.push(...proxyReqs.additionalNetworks);
    } catch (proxyError) {
      this.logger.warn(
        "Proxy prepareContainer failed: container will be created without proxy routing",
        {
          deploymentId: deployment.id,
          error: proxyError instanceof Error ? proxyError.message : String(proxyError),
        }
      );
    }

    const containerName = `${projectSlug}-${deployment.id.substring(0, 8)}`;
    const dockerContainer = await this.runtime.create({
      ...containerConfig,
      volumes: volumeMounts,
      name: containerName,
      labels: mergedLabels,
      networks,
    });

    const container = await this.createContainerDatabaseRecords(
      dockerContainer,
      deployment,
      project,
      containerConfig,
      containerName,
      networkName,
      image,
      containerNumber
    );

    return container;
  }

  async startContainer(managedContainer: ManagedContainer): Promise<void> {
    await this.runtime.start(managedContainer.containerId);

    await this.db.container.update({
      where: { id: managedContainer.id },
      data: { status: "STARTING", startedAt: new Date() },
    });
  }

  async waitForHealthy(containerId: string, timeoutMs: number): Promise<boolean> {
    this.logger.info("Waiting for container to be healthy", { containerId, timeoutMs });

    try {
      await this.runtime.waitForHealthy(containerId, { timeout: timeoutMs });
      return true;
    } catch (error) {
      this.logger.warn("Container health check failed", { containerId, error });
      return false;
    }
  }

  async stopAndRemove(containerId: string): Promise<void> {
    // Skip DB update if already terminated
    const existing = await this.db.container.findMany({
      where: { containerId, status: "TERMINATED" },
      select: { id: true },
    });
    if (existing.length > 0) {
      return;
    }

    try {
      await this.runtime.stop(containerId, { timeout: 10_000 });
    } catch {
      // Container may already be stopped — continue to remove
    }

    try {
      await this.runtime.remove(containerId, { force: true });
    } catch {
      // Container may already be removed — treat as success
    }

    await this.db.container.updateMany({
      where: { containerId, status: { not: "TERMINATED" } },
      data: { status: "TERMINATED", healthStatus: "UNHEALTHY" },
    });
  }

  async stopAndRemoveWithContext(
    containerId: string,
    projectId: string,
    deploymentId: string,
    projectName: string
  ): Promise<void> {
    // Skip DB update if already terminated
    const existing = await this.db.container.findMany({
      where: { containerId, status: "TERMINATED" },
      select: { id: true },
    });
    if (existing.length > 0) {
      return;
    }

    const networkName = generateNetworkName(projectId, projectName);

    try {
      await this.proxyIntegration.onContainerRemoved({
        projectId,
        deploymentId,
        containerId,
        networkName,
      });
    } catch (proxyError) {
      this.logger.warn("Proxy onContainerRemoved failed during container cleanup", {
        projectId,
        deploymentId,
        containerId,
        error: proxyError instanceof Error ? proxyError.message : String(proxyError),
      });
    }

    try {
      await this.runtime.stop(containerId, { timeout: 10_000 });
    } catch {
      // Container may already be stopped — continue to remove
    }

    try {
      await this.runtime.remove(containerId, { force: true });
    } catch {
      // Container may already be removed — treat as success
    }

    await this.db.container.updateMany({
      where: { containerId, status: { not: "TERMINATED" } },
      data: { status: "TERMINATED", healthStatus: "UNHEALTHY" },
    });
  }

  async forceTerminateByDeployment(
    deploymentId: string,
    projectId: string,
    deploymentName: string
  ): Promise<void> {
    const containers = await this.db.container.findMany({
      where: {
        deploymentId,
        status: { notIn: ["TERMINATED", "STOPPED"] },
      },
      select: { id: true, containerId: true },
    });

    if (containers.length === 0) return;

    this.logger.info("Force-terminating containers for deployment", {
      deploymentId,
      containerCount: containers.length,
    });

    for (const container of containers) {
      try {
        await this.stopAndRemoveWithContext(
          container.containerId,
          projectId,
          deploymentId,
          deploymentName
        );
      } catch {
        // Already handled inside stopAndRemoveWithContext — continue to next
      }
    }
  }

  async ensureNetwork(projectId: string, projectName: string): Promise<string> {
    const networkName = generateNetworkName(projectId, projectName);

    const existingNetworks = await this.runtime.listNetworks({
      name: [networkName],
    });

    if (existingNetworks.length > 0) {
      return networkName;
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

    this.logger.info("Created project network", { networkName, projectName });
    return networkName;
  }

  async ensureVolumes(
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

        this.logger.info("Created volume", { volumeName });
      }

      volumeMap.set(volumeConfig.mountPath, volumeName);
    }

    return volumeMap;
  }

  private buildContainerConfig(
    deployment: DeploymentData,
    project: ProjectData,
    image: string
  ): InternalContainerConfig {
    const config = project.config || {};
    const runtime = config.runtime || {};
    const lifecycle = config.lifecycle || {};
    const networking = config.networking;
    const resources = config.resources;
    const container = config.container;

    const labels = {
      "forge.managed": "true",
      "forge.projectId": project.id,
      "forge.deploymentId": deployment.id,
      "forge.type": "deployment-container",
      ...container?.labels,
    };

    const port = runtime.port || 3000;
    const baseEnv = runtime.env || {};
    let ports: Array<{ containerPort: number; hostPort?: number; protocol?: "tcp" | "udp" }> = [];
    if (networking?.ports && networking.ports.length > 0) {
      ports = networking.ports
        .filter((p) => !p.exposedOnly)
        .map((p) => ({
          containerPort: p.containerPort,
          hostPort: p.hostPort,
          protocol: p.protocol === "udp" ? "udp" : "tcp",
        }));
    } else {
      ports = [
        {
          containerPort: port,
          protocol: "tcp",
        },
      ];
    }

    let cmd: string[] | undefined;
    if (runtime.command) {
      cmd = typeof runtime.command === "string" ? runtime.command.split(" ") : runtime.command;
    }

    const restartPolicy: DockerRestartPolicy = {
      name: lifecycle.restart || "unless-stopped",
      maximumRetryCount: lifecycle.restartRetries,
    };

    return {
      image: image,
      cmd,
      entrypoint: runtime.entrypoint,
      env: {
        PORT: port.toString(),
        FORGE_PROJECT_ID: project.id,
        FORGE_DEPLOYMENT_ID: deployment.id,
        ...baseEnv,
      },
      ports,
      volumes: config.volumes || [],
      workingDir: runtime.workingDir,
      user: runtime.user,
      resources: resources
        ? {
            memory: resources.memory,
            memorySwap: resources.memorySwap,
            cpus: resources.cpus,
            cpuShares: resources.cpuShares,
          }
        : undefined,
      healthCheck: this.getHealthCheckConfig(project),
      restartPolicy,
      autoRemove: lifecycle.autoRemove || false,
      readOnly: container?.readOnlyRootFs,
      capabilities: container?.capabilities,
      labels,
    };
  }

  private getHealthCheckConfig(project: ProjectData): ProjectHealthCheckConfig | undefined {
    const config = project.config || {};
    return config.healthCheck;
  }

  private getTargetPort(project: ProjectData): number {
    const config = project.config || {};
    return config.runtime?.port || 3000;
  }

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

  private async createContainerDatabaseRecords(
    dockerContainer: { id: string },
    deployment: DeploymentData,
    project: ProjectData,
    containerConfig: InternalContainerConfig,
    containerName: string,
    networkName: string,
    image: string,
    containerNumber?: number
  ): Promise<ManagedContainer> {
    return await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
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
          ...(containerNumber != null && { containerNumber }),
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

  private generateVolumeName(projectId: string, mountPath: string, customName?: string): string {
    if (customName) {
      return customName;
    }

    const pathParts = mountPath.split("/").filter(Boolean);
    const pathSlug = pathParts.slice(-2).join("-");
    return `forge-volume-${pathSlug}-${projectId}`;
  }

  private parseTimeToInt(time?: string): number | undefined {
    if (!time) return undefined;
    const match = time.match(/^(\d+)(s|m|h)?$/);
    if (!match) return undefined;

    const value = parseInt(match[1], 10);
    const unit = match[2] || "s";

    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600 };
    return value * multipliers[unit];
  }

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
}
