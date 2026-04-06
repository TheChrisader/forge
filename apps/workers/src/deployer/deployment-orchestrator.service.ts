/**
 * Deployment Orchestrator Service
 *
 * Coordinates the full deployment lifecycle:
 * - Create container from built image
 * - Start container
 * - Wait for health check
 * - Update deployment status
 */

import type { ILogger } from "@forge/core";
import type { PrismaClient } from "@forge/database";
import type { LogLevel } from "@forge/types";
import type {
  DockerRuntime,
  VolumeMount as DockerVolumeMount,
  RestartPolicy as DockerRestartPolicy,
} from "@forge/docker";
import { generateNetworkName } from "@forge/docker";
import type {
  DeploymentStatus,
  ContainerConfig,
  ProjectConfig,
  ProjectVolumeConfig,
  ProjectHealthCheckConfig,
} from "@forge/types";
import { toPrismaJson } from "@forge/types";
import type { IProxyIntegration } from "@forge/proxy";

export interface DeployProgressCallback {
  (event: {
    message: string;
    level?: LogLevel;
    stage?: string;
    progress?: number;
  }): void | Promise<void>;
}

interface DeploymentData {
  id: string;
}

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
  progressCallback?: DeployProgressCallback;
}

export class DeploymentOrchestrator {
  constructor(
    private readonly db: PrismaClient,
    private readonly runtime: DockerRuntime,
    private readonly logger: ILogger,
    private readonly proxyIntegration: IProxyIntegration
  ) {}

  private async emitProgress(
    callback: DeployProgressCallback | undefined,
    message: string,
    level: LogLevel = "INFO" as LogLevel,
    stage?: string,
    progress?: number
  ): Promise<void> {
    if (callback) {
      await callback({ message, level, stage, progress });
    }
  }

  async deploy(deploymentId: string, image: string, options?: DeployOptions): Promise<void> {
    this.logger.info("Starting deployment orchestration", { deploymentId, image });

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

    await this.emitProgress(
      options?.progressCallback,
      "Starting deployment...",
      "INFO" as LogLevel,
      "deploy",
      10
    );

    await this.emitProgress(
      options?.progressCallback,
      "Creating container...",
      "INFO" as LogLevel,
      "container-create",
      25
    );

    this.logger.info("Creating container", { deploymentId, image });
    const container = await this.createContainer(deployment as DeploymentData, project, image);

    await this.emitProgress(
      options?.progressCallback,
      "Starting container...",
      "INFO" as LogLevel,
      "container-start",
      50
    );

    this.logger.info("Starting container", { deploymentId, containerId: container.containerId });
    await this.runtime.start(container.containerId);

    await this.db.container.update({
      where: { id: container.id },
      data: { status: "STARTING", startedAt: new Date() },
    });

    await this.emitProgress(
      options?.progressCallback,
      "Waiting for health check...",
      "INFO" as LogLevel,
      "health-check",
      75
    );

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

      const projectSlug = project.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-");

      try {
        const proxyResult = await this.proxyIntegration.onContainerDeployed({
          projectId: project.id,
          projectSlug,
          deploymentId,
          containerId: container.containerId,
          networkName: generateNetworkName(project.id, project.name),
        });

        for (const url of proxyResult.urls) {
          await this.db.deploymentUrl.create({
            data: {
              deploymentId,
              url,
              isPreview: false,
            },
          });
        }
      } catch (proxyError) {
        this.logger.warn(
          "Proxy integration failed — container is running but may not be externally routable",
          {
            deploymentId,
            error: proxyError instanceof Error ? proxyError.message : String(proxyError),
          }
        );
      }

      await this.emitProgress(
        options?.progressCallback,
        "Deployment completed successfully",
        "INFO" as LogLevel,
        "complete",
        100
      );

      this.logger.info("Deployment completed successfully", {
        deploymentId,
        containerId: container.containerId,
      });
    } else {
      await this.handleFailure(
        deploymentId,
        container.containerId,
        "Container failed health check"
      );
    }
  }

  private async createContainer(
    deployment: DeploymentData,
    project: ProjectData,
    image: string
  ): Promise<{ id: string; containerId: string }> {
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
        "Proxy prepareContainer failed — container will be created without proxy routing",
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
      image
    );

    return container;
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

  private async ensureNetwork(projectId: string, projectName: string): Promise<void> {
    const networkName = generateNetworkName(projectId, projectName);

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

    this.logger.info("Created project network", { networkName, projectName });
  }

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

        this.logger.info("Created volume", { volumeName });
      }

      volumeMap.set(volumeConfig.mountPath, volumeName);
    }

    return volumeMap;
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
      name: (lifecycle.restart || "unless-stopped") as
        | "no"
        | "always"
        | "on-failure"
        | "unless-stopped",
      maximumRetryCount: lifecycle.restartRetries,
    };

    return {
      image: image,
      cmd,
      entrypoint: runtime.entrypoint,
      env: {
        // TODO: default env vars per framework/language - node only, for now
        // NODE_ENV: "production",
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
      // TODO: Add them to ContainerConfig, then use them in the create method - Don't delete
      // securityOpts: container?.securityOpts,
      // privileged: container?.privileged,
      // hostPid: container?.hostPid,
      // hostNetwork: container?.hostNetwork,
      // shmSize: container?.shmSize,
      // tmpfs: container?.tmpfs,
      // logging: container?.logging,
      labels,
    };
  }

  private getHealthCheckConfig(project: ProjectData): ProjectHealthCheckConfig | undefined {
    const config = project.config || {};

    if (config.healthCheck) {
      return config.healthCheck;
    }

    const port = config.runtime?.port || 3000;
    return {
      test: ["CMD", "curl", "-f", `http://localhost:${port}/health`],
      interval: "10s",
      timeout: "5s",
      retries: 3,
      startPeriod: "30s",
    };
  }

  private async waitForHealthy(containerId: string, timeoutMs: number): Promise<boolean> {
    this.logger.info("Waiting for container to be healthy", { containerId, timeoutMs });

    try {
      await this.runtime.waitForHealthy(containerId, { timeout: timeoutMs });
      return true;
    } catch (error) {
      this.logger.warn("Container health check failed", { containerId, error });
      return false;
    }
  }

  async handleFailure(
    deploymentId: string,
    containerId: string | null,
    error: string
  ): Promise<void> {
    this.logger.error("Handling deployment failure", { deploymentId, containerId, error });

    if (containerId) {
      try {
        const deployment = await this.db.deployment.findUnique({
          where: { id: deploymentId },
          include: { project: { select: { id: true, name: true } } },
        });

        if (deployment?.project) {
          const networkName = generateNetworkName(deployment.project.id, deployment.project.name);
          await this.proxyIntegration.onContainerRemoved({
            projectId: deployment.project.id,
            deploymentId,
            containerId,
            networkName,
          });
        }
      } catch (proxyError) {
        this.logger.warn("Proxy onContainerRemoved failed", {
          deploymentId,
          error: proxyError instanceof Error ? proxyError.message : String(proxyError),
        });
      }

      try {
        await this.runtime.stop(containerId, { timeout: 10_000 });
        await this.runtime.remove(containerId, { force: true });
      } catch (err) {
        this.logger.error("Failed to cleanup container after deployment failure - resource leak", {
          containerId,
          err: err instanceof Error ? err.message : String(err),
        });
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

  private getTargetPort(project: ProjectData): number {
    const config = project.config || {};
    return config.runtime?.port || 3000;
  }
}
