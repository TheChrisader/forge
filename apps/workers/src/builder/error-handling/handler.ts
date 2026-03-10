import type { ILogger } from "@forge/core";
import type { PrismaClient } from "@forge/database";
import { BuildErrorClassifier } from "./classifier.js";
import type { DeploymentStatus } from "@forge/types";

interface BuildFailureContext {
  deploymentId: string;
  projectId: string;
  logger: ILogger;
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

    logger[strategy.logLevel]("Build job failed", {
      deploymentId,
      projectId,
      error: error instanceof Error ? error.message : String(error),
      shouldRetry: strategy.shouldRetry,
      deploymentStatus: strategy.deploymentStatus,
    });

    try {
      await db.deployment.update({
        where: { id: deploymentId },
        data: {
          status: strategy.deploymentStatus as DeploymentStatus,
          error: strategy.userMessage,
          buildCompletedAt: strategy.shouldRetry ? null : new Date(),
        },
      });
    } catch (dbError) {
      // Critical: we couldn't update the database. Log and re-throw to trigger alerting.
      logger.error("Failed to update deployment status after build failure", {
        deploymentId,
        originalError: error instanceof Error ? error.message : String(error),
        dbError: dbError instanceof Error ? dbError.message : String(dbError),
      });
      throw dbError; // Re-throw to trigger BullMQ's failure handling
    }

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
