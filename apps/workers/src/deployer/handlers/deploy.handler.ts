import { getDatabaseClient } from "@forge/database";
import { DockerRuntime } from "@forge/docker";
import type { DeployJobData } from "@forge/types";
import type { IJobContext } from "@forge/queue";
import { LoggerService } from "@forge/logger";
import type { LogLevel } from "@forge/core";
import { DeploymentOrchestrator } from "../deployment-orchestrator.service.js";

const logger = new LoggerService({
  level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
  enabled: true,
  name: "deploy-handler",
});

export async function handleDeployJob(context: IJobContext<DeployJobData>): Promise<void> {
  const { deploymentId, projectId, image } = context.job.data;

  logger.info("Processing deploy job", { deploymentId, projectId, image });

  const db = getDatabaseClient();
  const runtime = new DockerRuntime();
  const orchestrator = new DeploymentOrchestrator(db, runtime, logger);

  try {
    await orchestrator.deploy(deploymentId, image);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Deployment failed", { deploymentId, error: errorMessage });

    // Update deployment status to FAILED and cleanup
    await orchestrator.handleFailure(deploymentId, null, errorMessage);

    // Re-throw for BullMQ retry logic (will be marked failed after max retries)
    throw error;
  }
}
