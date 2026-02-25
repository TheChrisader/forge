import pino from "pino";
import type { PrismaClient } from "@forge/database";
import { BuildErrorClassifier } from "./classifier.js";
import type { DeploymentStatus } from "@forge/types";

interface BuildFailureContext {
  deploymentId: string;
  projectId: string;
  logger: pino.Logger;
  db: PrismaClient;
  error: unknown;
}

/**
 * Handles build failures by:
 * 1. Categorizing the error (transient vs permanent)
 * 2. Logging appropriately
 * 3. Updating deployment status
 * 4. Returning whether to retry (throws) or not (returns normally)
 *
 * KEY INSIGHT: For permanent errors, we DON'T throw. This prevents BullMQ retry.
 * For transient errors, we DO throw, allowing BullMQ's exponential backoff.
 */
export class BuildErrorHandler {
  private readonly classifier = new BuildErrorClassifier();

  async handle(context: BuildFailureContext): Promise<never | void> {
    const { deploymentId, projectId, logger, db, error } = context;

    const strategy = this.classifier.classify(error);

    logger[strategy.logLevel](
      {
        deploymentId,
        projectId,
        error: error instanceof Error ? error.message : String(error),
        shouldRetry: strategy.shouldRetry,
        deploymentStatus: strategy.deploymentStatus,
      },
      "Build job failed"
    );

    await db.deployment.update({
      where: { id: deploymentId },
      data: {
        status: strategy.deploymentStatus as DeploymentStatus,
        error: strategy.userMessage,
        // Only set completedAt if this is a permanent failure
        buildCompletedAt: strategy.shouldRetry ? null : new Date(),
      },
    });

    if (!strategy.shouldRetry) {
      await this.resetProjectStatus(db, projectId);
      // Return normally - no retry
      return;
    }

    // Transient error - throw to trigger BullMQ retry
    throw error;
  }

  private async resetProjectStatus(db: PrismaClient, projectId: string): Promise<void> {
    try {
      await db.project.update({
        where: { id: projectId },
        data: { status: "ACTIVE" }, // Reset to active, not idle
      });
    } catch (error) {
      // Don't fail the error handler if we can't reset project status
      console.error("Failed to reset project status", { error, projectId });
    }
  }
}
