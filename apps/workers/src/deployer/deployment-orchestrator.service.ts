import type { ILogger } from "@forge/core";
import type { PrismaClient } from "@forge/database";
import type { LogLevel } from "@forge/types";
import type { ProjectConfig } from "@forge/types";
import { generateNetworkName } from "@forge/docker";
import type { DeploymentStatus } from "@forge/types";
import type { IProxyIntegration } from "@forge/proxy";
import type {
  IDeploymentStrategyRegistry,
  DeploymentContext,
  DeploymentResult,
  DeploymentProgress,
  ProgressCallback,
} from "@forge/deploy";
import type { IContainerLifecycle } from "@forge/deploy";

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
  strategy?: string;
  activeEnvironment?: "BLUE" | "GREEN" | null;
  canaryPercentage?: number | null;
}

interface ProjectData {
  id: string;
  name: string;
  config: ProjectConfig;
}

interface DeployOptions {
  healthCheckTimeout?: number;
  progressCallback?: DeployProgressCallback;
}

export class DeploymentOrchestrator {
  constructor(
    private readonly db: PrismaClient,
    private readonly strategyRegistry: IDeploymentStrategyRegistry,
    private readonly lifecycle: IContainerLifecycle,
    private readonly logger: ILogger,
    private readonly proxyIntegration: IProxyIntegration
  ) {}

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
    const deploymentData = deployment as unknown as DeploymentData;

    const strategyName = deploymentData.strategy ?? "ROLLING";
    const strategy = this.strategyRegistry.get(strategyName);
    if (!strategy) {
      throw new Error(`Unknown deployment strategy: ${strategyName}`);
    }

    this.logger.info("Deployment strategy resolved", {
      deploymentId,
      strategy: strategyName,
    });

    const context = await this.buildDeploymentContext(deploymentData, project, image);

    const validation = strategy.validate(context);
    if (!validation.valid) {
      throw new Error(
        `Deployment validation failed: ${validation.errors?.join("; ") ?? "unknown error"}`
      );
    }

    await this.db.deployment.update({
      where: { id: deploymentId },
      data: {
        status: "DEPLOYING" as DeploymentStatus,
        deployStartedAt: new Date(),
        buildImage: image,
      },
    });

    const adaptedProgress = this.adaptProgressCallback(options?.progressCallback);
    const result = await strategy.execute(context, adaptedProgress);

    if (result.success) {
      await this.handleSuccess(deploymentId, project, result);
    } else {
      await this.handleFailure(deploymentId, result.error ?? "Strategy execution failed");
      throw new Error(`Deployment failed: ${result.error ?? "Strategy execution failed"}`);
    }
  }

  private async handleSuccess(
    deploymentId: string,
    project: ProjectData,
    result: DeploymentResult
  ): Promise<void> {
    this.logger.info("Deployment succeeded — finalizing", {
      deploymentId,
      containerCount: result.containers.length,
      removedCount: result.removedContainerIds.length,
    });

    await this.db.deployment.update({
      where: { id: deploymentId },
      data: {
        status: "RUNNING" as DeploymentStatus,
        deployCompletedAt: new Date(),
        ...(result.activeEnvironment && {
          activeEnvironment: result.activeEnvironment,
        }),
      },
    });

    await this.db.deployment.updateMany({
      where: {
        projectId: project.id,
        id: { not: deploymentId },
        status: "RUNNING",
      },
      data: {
        status: "SUCCEEDED",
        deployCompletedAt: new Date(),
      },
    });

    await this.db.project.update({
      where: { id: project.id },
      data: { status: "ACTIVE" },
    });

    for (const c of result.containers) {
      await this.db.container.update({
        where: { id: c.id },
        data: { status: "HEALTHY", healthStatus: "HEALTHY" },
      });
    }

    const projectSlug = project.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    const networkName = generateNetworkName(project.id, project.name);

    for (const c of result.containers) {
      try {
        const proxyResult = await this.proxyIntegration.onContainerDeployed({
          projectId: project.id,
          projectSlug,
          deploymentId,
          containerId: c.containerId,
          networkName,
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
          "Proxy onContainerDeployed failed: Container running but may not be routable",
          {
            deploymentId,
            containerId: c.containerId,
            error: proxyError instanceof Error ? proxyError.message : String(proxyError),
          }
        );
      }
    }
  }

  async handleFailure(deploymentId: string, error: string): Promise<void> {
    this.logger.error("Handling deployment failure", { deploymentId, error });

    //    (safety net. the strategy should have cleaned up its own containers,
    //    but if it threw before finishing, some may remain)
    const deployment = await this.db.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        containers: { where: { status: { notIn: ["TERMINATED", "STOPPED"] } } },
        project: { select: { id: true, name: true } },
      },
    });

    if (deployment) {
      for (const container of deployment.containers) {
        try {
          await this.lifecycle.stopAndRemoveWithContext(
            container.containerId,
            deployment.project.id,
            deploymentId,
            deployment.project.name
          );
        } catch (err) {
          this.logger.error("Failed to cleanup container — resource leak", {
            containerId: container.containerId,
            err: err instanceof Error ? err.message : String(err),
          });
        }
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

    await this.db.container.updateMany({
      where: { deploymentId, status: { notIn: ["TERMINATED", "STOPPED"] } },
      data: { status: "TERMINATED", healthStatus: "UNHEALTHY" },
    });
  }

  private adaptProgressCallback(callback?: DeployProgressCallback): ProgressCallback | undefined {
    if (!callback) return undefined;

    return (progress: DeploymentProgress) => {
      callback({
        message: progress.message,
        level: "INFO" as LogLevel,
        stage: progress.phase,
        progress: progress.percentage,
      });
    };
  }

  private async buildDeploymentContext(
    deployment: DeploymentData,
    project: ProjectData,
    image: string
  ): Promise<DeploymentContext> {
    const config = project.config || {};
    const projectSlug = project.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    const networkName = generateNetworkName(project.id, project.name);

    const existingContainers = await this.db.container.findMany({
      where: {
        projectId: project.id,
        status: { notIn: ["TERMINATED", "STOPPED"] },
      },
      select: { containerId: true },
    });

    const domains = await this.db.domain.findMany({
      where: { projectId: project.id, verified: true },
      select: { domain: true },
    });

    return {
      deploymentId: deployment.id,
      projectId: project.id,
      projectName: project.name,
      projectSlug,
      image,
      replicas: 1, // TODO: get from project config or deployment metadata
      env: config.runtime?.env || {},
      ports: [], // TODO: derived from config same as current buildContainerConfig, or get from nixpacks
      volumes: config.volumes || [],
      healthCheck: config.healthCheck,
      resources: config.resources,
      labels: {},
      networkName,
      domains: domains.map((d: { domain: string }) => d.domain),
      targetPort: config.runtime?.port || 3000,
      activeEnvironment: deployment.activeEnvironment ?? undefined,
      canaryPercentage: deployment.canaryPercentage ?? undefined,
      existingContainerIds: existingContainers.map((c: { containerId: string }) => c.containerId),
    };
  }
}
