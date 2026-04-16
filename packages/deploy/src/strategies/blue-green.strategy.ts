import type { ILogger } from "@forge/core";
import type {
  IDeploymentStrategy,
  DeploymentContext,
  DeploymentResult,
  DeploymentProgress,
  ProgressCallback,
} from "../interfaces/strategy";
import type { IContainerLifecycle, ManagedContainer } from "../helpers/container-lifecycle";
import { ProjectConfig } from "@forge/types";

export class BlueGreenStrategy implements IDeploymentStrategy {
  readonly strategyName = "BLUE_GREEN" as const;

  constructor(
    private readonly lifecycle: IContainerLifecycle,
    private readonly logger: ILogger
  ) {}

  validate(context: DeploymentContext): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!context.image) {
      errors.push("Image is required");
    }
    if (!context.projectId) {
      errors.push("Project ID is required");
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(
    context: DeploymentContext,
    onProgress?: ProgressCallback
  ): Promise<DeploymentResult> {
    const startTime = Date.now();
    const deployedContainers: ManagedContainer[] = [];
    const removedContainerIds: string[] = [];

    const emit = (
      phase: DeploymentProgress["phase"],
      percentage: number,
      message: string
    ): void => {
      if (onProgress) {
        onProgress({ phase, percentage, message, timestamp: new Date() });
      }
    };

    try {
      const newEnvironment = context.activeEnvironment === "BLUE" ? "GREEN" : "BLUE";

      emit(
        "preparing",
        5,
        `Deploying to ${newEnvironment} environment (current: ${context.activeEnvironment ?? "none"})...`
      );

      this.logger.info("Blue-green deployment starting", {
        deploymentId: context.deploymentId,
        currentActive: context.activeEnvironment ?? "none",
        deployingTo: newEnvironment,
      });

      emit("deploying", 10, `Creating containers in ${newEnvironment} environment...`);

      const replicaCount = Math.max(1, context.replicas);

      for (let i = 0; i < replicaCount; i++) {
        this.logger.info("Creating container in new environment", {
          deploymentId: context.deploymentId,
          environment: newEnvironment,
          replica: i + 1,
          total: replicaCount,
        });

        const container = await this.lifecycle.createContainer(
          { id: context.deploymentId },
          {
            id: context.projectId,
            name: context.projectName,
            config: this.buildProjectConfig(context, newEnvironment),
          },
          context.image,
          i + 1
        );

        deployedContainers.push(container);
        emit(
          "deploying",
          10 + (20 * (i + 1)) / replicaCount,
          `Created ${newEnvironment} container ${i + 1}/${replicaCount}`
        );
      }

      emit("deploying", 35, `Starting ${newEnvironment} containers...`);

      for (let i = 0; i < deployedContainers.length; i++) {
        await this.lifecycle.startContainer(deployedContainers[i]);
        emit(
          "deploying",
          35 + (10 * (i + 1)) / deployedContainers.length,
          `Started ${newEnvironment} container ${i + 1}/${deployedContainers.length}`
        );
      }

      emit("verifying", 50, `Waiting for ${newEnvironment} health checks...`);

      let allHealthy = true;
      for (let i = 0; i < deployedContainers.length; i++) {
        const healthy = await this.lifecycle.waitForHealthy(
          deployedContainers[i].containerId,
          120_000
        );

        if (!healthy) {
          this.logger.error("Blue-green deployment: container failed health check", {
            deploymentId: context.deploymentId,
            environment: newEnvironment,
            containerId: deployedContainers[i].containerId,
          });

          allHealthy = false;
          break;
        }

        emit(
          "verifying",
          50 + (20 * (i + 1)) / deployedContainers.length,
          `${newEnvironment} container ${i + 1} is healthy`
        );
      }

      if (!allHealthy) {
        emit("failed", 70, `${newEnvironment} environment failed health check — rolling back`);

        for (const container of deployedContainers) {
          try {
            await this.lifecycle.stopAndRemoveWithContext(
              container.containerId,
              context.projectId,
              context.deploymentId,
              context.projectName
            );
          } catch (err) {
            this.logger.error("Failed to cleanup new environment container", {
              containerId: container.containerId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        return {
          success: false,
          containers: [],
          removedContainerIds: deployedContainers.map((c) => c.containerId),
          duration: Date.now() - startTime,
          error: `${newEnvironment} environment failed health check — old environment left untouched`,
        };
      }

      emit("verifying", 75, `Switching active environment to ${newEnvironment}...`);

      this.logger.info("Switching active environment", {
        deploymentId: context.deploymentId,
        from: context.activeEnvironment ?? "none",
        to: newEnvironment,
      });

      if (context.existingContainerIds.length > 0) {
        emit(
          "deploying",
          80,
          `Removing ${context.activeEnvironment ?? "old"} environment containers...`
        );

        for (const containerId of context.existingContainerIds) {
          try {
            await this.lifecycle.stopAndRemoveWithContext(
              containerId,
              context.projectId,
              context.deploymentId,
              context.projectName
            );
            removedContainerIds.push(containerId);
          } catch (err) {
            this.logger.warn("Failed to remove old environment container — continuing", {
              containerId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      emit(
        "complete",
        100,
        `Blue-green deployment complete: active environment is now ${newEnvironment}`
      );

      return {
        success: true,
        containers: deployedContainers.map((c) => ({ id: c.id, containerId: c.containerId })),
        removedContainerIds,
        duration: Date.now() - startTime,
        activeEnvironment: newEnvironment,
      };
    } catch (error) {
      this.logger.error("Blue-green strategy failed", {
        deploymentId: context.deploymentId,
        error: error instanceof Error ? error.message : String(error),
      });

      for (const container of deployedContainers) {
        try {
          await this.lifecycle.stopAndRemoveWithContext(
            container.containerId,
            context.projectId,
            context.deploymentId,
            context.projectName
          );
        } catch (err) {
          this.logger.error("Failed to cleanup container after strategy error", {
            containerId: container.containerId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      emit("failed", 0, "Blue-green deployment failed");

      return {
        success: false,
        containers: [],
        removedContainerIds: [
          ...removedContainerIds,
          ...deployedContainers.map((c) => c.containerId),
        ],
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private buildProjectConfig(
    context: DeploymentContext,
    _environment: "BLUE" | "GREEN"
  ): ProjectConfig {
    return {
      runtime: {
        port: context.targetPort,
        env: context.env,
      },
      volumes: context.volumes,
      healthCheck: context.healthCheck,
      resources: context.resources,
    };
  }
}
