import type { ILogger } from "@forge/core";
import type {
  IDeploymentStrategy,
  DeploymentContext,
  DeploymentResult,
  DeploymentProgress,
  ProgressCallback,
} from "../interfaces/strategy";
import type { IContainerLifecycle, ManagedContainer } from "../helpers/container-lifecycle";

export class RecreateStrategy implements IDeploymentStrategy {
  readonly strategyName = "RECREATE" as const;

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
      emit("preparing", 10, "Stopping existing containers...");

      if (context.existingContainerIds.length > 0) {
        this.logger.info("Stopping existing containers for recreate deployment", {
          deploymentId: context.deploymentId,
          count: context.existingContainerIds.length,
        });

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
            this.logger.warn("Failed to stop existing container — continuing", {
              containerId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      emit("deploying", 25, "Creating new containers...");

      const replicaCount = Math.max(1, context.replicas);

      for (let i = 0; i < replicaCount; i++) {
        this.logger.info("Creating container", {
          deploymentId: context.deploymentId,
          replica: i + 1,
          total: replicaCount,
        });

        const container = await this.lifecycle.createContainer(
          { id: context.deploymentId },
          {
            id: context.projectId,
            name: context.projectName,
            config: this.buildProjectConfig(context),
          },
          context.image,
          i + 1
        );

        deployedContainers.push(container);
        emit(
          "deploying",
          25 + (30 * (i + 1)) / replicaCount,
          `Created container ${i + 1}/${replicaCount}`
        );
      }

      emit("deploying", 60, "Starting new containers...");

      for (let i = 0; i < deployedContainers.length; i++) {
        await this.lifecycle.startContainer(deployedContainers[i]);
        emit(
          "deploying",
          60 + (10 * (i + 1)) / deployedContainers.length,
          `Started container ${i + 1}/${deployedContainers.length}`
        );
      }

      emit("verifying", 75, "Waiting for health checks...");

      for (let i = 0; i < deployedContainers.length; i++) {
        const healthy = await this.lifecycle.waitForHealthy(
          deployedContainers[i].containerId,
          120_000
        );

        if (!healthy) {
          this.logger.error("Container health check failed during recreate deployment", {
            deploymentId: context.deploymentId,
            containerId: deployedContainers[i].containerId,
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
              this.logger.error("Failed to cleanup container after health check failure", {
                containerId: container.containerId,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }

          emit("failed", 75, `Container ${i + 1} failed health check`);

          return {
            success: false,
            containers: [],
            removedContainerIds: [
              ...removedContainerIds,
              ...deployedContainers.map((c) => c.containerId),
            ],
            duration: Date.now() - startTime,
            error: `Container ${i + 1} failed health check`,
          };
        }

        emit(
          "verifying",
          75 + (20 * (i + 1)) / deployedContainers.length,
          `Container ${i + 1} is healthy`
        );
      }

      emit("complete", 100, "Deployment completed successfully");

      return {
        success: true,
        containers: deployedContainers.map((c) => ({ id: c.id, containerId: c.containerId })),
        removedContainerIds,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error("Recreate strategy failed", {
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

      emit("failed", 0, "Deployment failed");

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

  /**
   * Build a minimal ProjectConfig from DeploymentContext.
   * The lifecycle helper only needs specific config fields.
   */
  private buildProjectConfig(context: DeploymentContext): import("@forge/types").ProjectConfig {
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
