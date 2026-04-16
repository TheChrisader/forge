/**
 * Canary Strategy
 *
 * Percentage-based traffic rollout — deploys a single canary container, tracks
 * its health, and progressively increases traffic percentage. Starts in
 * "dark canary" mode (deploy the container but don't split traffic) since
 * weighted traffic splitting via Traefik WRR labels is not yet implemented.
 *
 * TODO: implement weighted traffic splitting via Traefik WRR labels
 */

import type { ILogger } from "@forge/core";
import type {
  IDeploymentStrategy,
  DeploymentContext,
  DeploymentResult,
  DeploymentProgress,
  ProgressCallback,
} from "../interfaces/strategy";
import type { IContainerLifecycle, ManagedContainer } from "../helpers/container-lifecycle";

/** Canary observation window between percentage increases (ms) */
const CANARY_OBSERVATION_INTERVAL = parseInt(
  process.env.CANARY_OBSERVATION_INTERVAL ?? "30000",
  10
);

/** Percentage step increments during canary progression */
const CANARY_STEP_PERCENTAGE = parseInt(process.env.CANARY_STEP_PERCENTAGE ?? "20", 10);

/** Initial canary percentage */
const CANARY_INITIAL_PERCENTAGE = parseInt(process.env.CANARY_INITIAL_PERCENTAGE ?? "10", 10);

export class CanaryStrategy implements IDeploymentStrategy {
  readonly strategyName = "CANARY" as const;

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
    if (context.existingContainerIds.length === 0) {
      errors.push("Canary strategy requires existing containers to compare against");
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(
    context: DeploymentContext,
    onProgress?: ProgressCallback
  ): Promise<DeploymentResult> {
    const startTime = Date.now();
    let canaryContainer: ManagedContainer | null = null;
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
      const initialPercentage = context.canaryPercentage ?? CANARY_INITIAL_PERCENTAGE;

      emit("preparing", 5, `Starting canary deployment at ${initialPercentage}%...`);

      emit("deploying", 10, "Creating canary container...");

      canaryContainer = await this.lifecycle.createContainer(
        { id: context.deploymentId },
        {
          id: context.projectId,
          name: context.projectName,
          config: this.buildProjectConfig(context),
        },
        context.image,
        1 // Canary always uses containerNumber 1
      );

      emit("deploying", 20, "Starting canary container...");

      await this.lifecycle.startContainer(canaryContainer);

      emit("verifying", 30, "Waiting for canary health check...");

      const healthy = await this.lifecycle.waitForHealthy(canaryContainer.containerId, 120_000);

      if (!healthy) {
        this.logger.error("Canary container failed health check", {
          deploymentId: context.deploymentId,
          containerId: canaryContainer.containerId,
        });

        try {
          await this.lifecycle.stopAndRemoveWithContext(
            canaryContainer.containerId,
            context.projectId,
            context.deploymentId,
            context.projectName
          );
        } catch (err) {
          this.logger.error("Failed to cleanup canary container", {
            containerId: canaryContainer.containerId,
            error: err instanceof Error ? err.message : String(err),
          });
        }

        emit("failed", 40, "Canary container failed health check");

        return {
          success: false,
          containers: [],
          removedContainerIds: [canaryContainer.containerId],
          duration: Date.now() - startTime,
          error: "Canary container failed health check",
        };
      }

      // 3. Progressively increase canary percentage
      // TODO: implement weighted traffic splitting via Traefik WRR labels
      // Currently this is "dark canary" mode — the container is running but
      // traffic is not actually split. The percentage is tracked in the DB
      // for observability and future WRR label integration.
      emit(
        "verifying",
        50,
        `Canary is healthy — progressive rollout starting at ${initialPercentage}%...`
      );

      let currentPercentage = initialPercentage;

      while (currentPercentage < 100) {
        this.logger.info("Canary observation period", {
          deploymentId: context.deploymentId,
          currentPercentage,
          observationInterval: CANARY_OBSERVATION_INTERVAL,
        });

        emit(
          "verifying",
          50 + (40 * currentPercentage) / 100,
          `Observing canary at ${currentPercentage}% traffic...`
        );

        await this.sleep(CANARY_OBSERVATION_INTERVAL);

        currentPercentage = Math.min(100, currentPercentage + CANARY_STEP_PERCENTAGE);

        this.logger.info("Increasing canary percentage", {
          deploymentId: context.deploymentId,
          newPercentage: currentPercentage,
        });

        // TODO: update Traefik WRR labels here when weighted traffic splitting is implemented
      }

      emit("deploying", 92, "Canary at 100% — replacing old containers...");

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
          this.logger.warn("Failed to remove old container during canary finalization", {
            containerId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const additionalContainers: ManagedContainer[] = [];
      const desiredReplicas = Math.max(1, context.replicas);

      for (let i = 1; i < desiredReplicas; i++) {
        try {
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

          await this.lifecycle.startContainer(container);
          additionalContainers.push(container);

          const containerHealthy = await this.lifecycle.waitForHealthy(
            container.containerId,
            120_000
          );

          if (!containerHealthy) {
            this.logger.warn("Scale-up container failed health check — continuing with remaining", {
              deploymentId: context.deploymentId,
              containerId: container.containerId,
            });
          }
        } catch (err) {
          this.logger.warn("Failed to create scale-up container — continuing", {
            deploymentId: context.deploymentId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const allContainers = canaryContainer
        ? [canaryContainer, ...additionalContainers]
        : additionalContainers;

      emit("complete", 100, "Canary deployment complete — all traffic routed to new containers");

      return {
        success: true,
        containers: allContainers.map((c) => ({ id: c.id, containerId: c.containerId })),
        removedContainerIds,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error("Canary strategy failed", {
        deploymentId: context.deploymentId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (canaryContainer) {
        try {
          await this.lifecycle.stopAndRemoveWithContext(
            canaryContainer.containerId,
            context.projectId,
            context.deploymentId,
            context.projectName
          );
        } catch (err) {
          this.logger.error("Failed to cleanup canary container after strategy error", {
            containerId: canaryContainer.containerId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      emit("failed", 0, "Canary deployment failed");

      return {
        success: false,
        containers: [],
        removedContainerIds,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
