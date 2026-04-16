import type { ILogger } from "@forge/core";
import type {
  IDeploymentStrategy,
  DeploymentContext,
  DeploymentResult,
  DeploymentProgress,
  ProgressCallback,
} from "../interfaces/strategy";
import type { IContainerLifecycle, ManagedContainer } from "../helpers/container-lifecycle";

// TODO: support per-deployment maxSurge/maxUnavailable via DeployJobData and Deployment model
// const DEFAULT_MAX_SURGE = parseInt(process.env.DEPLOY_MAX_SURGE ?? "1", 10);
// const DEFAULT_MAX_UNAVAILABLE = parseInt(process.env.DEPLOY_MAX_UNAVAILABLE ?? "0", 10);

export class RollingStrategy implements IDeploymentStrategy {
  readonly strategyName = "ROLLING" as const;

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
      const totalToReplace = context.existingContainerIds.length;

      if (totalToReplace === 0) {
        return this.freshDeploy(context, emit, deployedContainers);
      }

      emit("preparing", 5, `Rolling deployment: replacing ${totalToReplace} container(s)...`);

      const existingContainers = this.getExistingContainersSorted(context);

      const totalCount = existingContainers.length;

      for (let i = 0; i < totalCount; i++) {
        const oldContainer = existingContainers[i];
        const progressBase = 5 + (90 * i) / totalCount;

        this.logger.info("Replacing container", {
          deploymentId: context.deploymentId,
          replacement: i + 1,
          total: totalCount,
          oldContainerId: oldContainer.containerId,
          oldContainerNumber: oldContainer.containerNumber,
        });

        emit("deploying", progressBase, `Replacing container ${i + 1}/${totalCount}...`);

        try {
          const newContainer = await this.lifecycle.createContainer(
            { id: context.deploymentId },
            {
              id: context.projectId,
              name: context.projectName,
              config: this.buildProjectConfig(context),
            },
            context.image,
            totalCount + i + 1
          );

          deployedContainers.push(newContainer);

          await this.lifecycle.startContainer(newContainer);
          emit(
            "deploying",
            progressBase + 15,
            `Started replacement container ${i + 1}/${totalCount}`
          );

          emit(
            "verifying",
            progressBase + 25,
            `Waiting for health check on container ${i + 1}/${totalCount}...`
          );

          const healthy = await this.lifecycle.waitForHealthy(newContainer.containerId, 120_000);

          if (!healthy) {
            // Health check failed. Clean up ONLY this new container,
            // leave previously-replaced containers running.
            this.logger.error(
              "Replacement container failed health check — stopping partial replacement",
              {
                deploymentId: context.deploymentId,
                containerId: newContainer.containerId,
                succeededCount: deployedContainers.length - 1,
                failedAtIndex: i,
              }
            );

            try {
              await this.lifecycle.stopAndRemoveWithContext(
                newContainer.containerId,
                context.projectId,
                context.deploymentId,
                context.projectName
              );
            } catch (err) {
              this.logger.error("Failed to cleanup failed replacement container", {
                containerId: newContainer.containerId,
                error: err instanceof Error ? err.message : String(err),
              });
            }

            deployedContainers.pop();

            emit(
              "failed",
              progressBase + 30,
              `Container ${i + 1} failed health check — ${i} of ${totalCount} replaced`
            );

            return {
              success: false,
              containers: deployedContainers.map((c) => ({ id: c.id, containerId: c.containerId })),
              removedContainerIds,
              duration: Date.now() - startTime,
              error: `Replacement container ${i + 1}/${totalCount} failed health check. ${i} container(s) were successfully replaced.`,
            };
          }

          // TODO: update old container's replacedById in DB when lifecycle helper exposes this
          await this.lifecycle.stopAndRemoveWithContext(
            oldContainer.containerId,
            context.projectId,
            context.deploymentId,
            context.projectName
          );
          removedContainerIds.push(oldContainer.containerId);

          emit(
            "verifying",
            progressBase + 40,
            `Container ${i + 1}/${totalCount} replaced successfully`
          );
        } catch (err) {
          this.logger.error("Failed to create replacement container", {
            deploymentId: context.deploymentId,
            oldContainerId: oldContainer.containerId,
            error: err instanceof Error ? err.message : String(err),
          });

          emit("failed", progressBase, `Failed to replace container ${i + 1}/${totalCount}`);

          return {
            success: false,
            containers: deployedContainers.map((c) => ({ id: c.id, containerId: c.containerId })),
            removedContainerIds,
            duration: Date.now() - startTime,
            error: `Failed to replace container ${i + 1}/${totalCount}: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }

      emit("complete", 100, `Rolling deployment complete: ${totalCount} container(s) replaced`);

      return {
        success: true,
        containers: deployedContainers.map((c) => ({ id: c.id, containerId: c.containerId })),
        removedContainerIds,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error("Rolling strategy failed", {
        deploymentId: context.deploymentId,
        error: error instanceof Error ? error.message : String(error),
      });

      emit("failed", 0, "Rolling deployment failed");

      return {
        success: false,
        containers: deployedContainers.map((c) => ({ id: c.id, containerId: c.containerId })),
        removedContainerIds,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async freshDeploy(
    context: DeploymentContext,
    emit: (phase: DeploymentProgress["phase"], percentage: number, message: string) => void,
    deployedContainers: ManagedContainer[]
  ): Promise<DeploymentResult> {
    const startTime = Date.now();

    emit("deploying", 10, "Fresh rolling deploy: creating containers...");

    const replicaCount = Math.max(1, context.replicas);

    for (let i = 0; i < replicaCount; i++) {
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

      await this.lifecycle.startContainer(container);

      const healthy = await this.lifecycle.waitForHealthy(container.containerId, 120_000);

      if (!healthy) {
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

        deployedContainers.pop();

        emit("failed", 50, `Container ${i + 1} failed health check`);

        return {
          success: false,
          containers: [],
          removedContainerIds: [],
          duration: Date.now() - startTime,
          error: `Container ${i + 1} failed health check`,
        };
      }

      emit(
        "verifying",
        30 + (60 * (i + 1)) / replicaCount,
        `Container ${i + 1}/${replicaCount} is healthy`
      );
    }

    emit("complete", 100, "Fresh deployment complete");

    return {
      success: true,
      containers: deployedContainers.map((c) => ({ id: c.id, containerId: c.containerId })),
      removedContainerIds: [],
      duration: Date.now() - startTime,
    };
  }

  private getExistingContainersSorted(
    context: DeploymentContext
  ): Array<{ id: string; containerId: string; containerNumber: number }> {
    // Access the DB through a type-safe approach.
    // The lifecycle helper has access to Prisma but we can't reach it through the interface.
    // For now, we rely on existingContainerIds ordering.
    // A better approach would be to query the DB directly, but that requires passing
    // the DB client to strategies. This is acceptable for the initial implementation
    // since the orchestrator builds DeploymentContext with the correct container IDs.
    return context.existingContainerIds.map((id, index) => ({
      id,
      containerId: id,
      containerNumber: index + 1,
    }));
  }

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
