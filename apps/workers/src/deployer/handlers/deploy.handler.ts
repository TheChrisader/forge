import { getDatabaseClient } from "@forge/database";
import { DockerRuntime } from "@forge/docker";
import type { DeployJobData } from "@forge/types";
import type { IJobContext } from "@forge/queue";
import type { ILogger } from "@forge/core";
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

    // Orchestrator's handleFailure method updates the database
    // We only need to re-throw for queue retry logic
    throw error;
  }
}
