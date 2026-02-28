import { getDatabaseClient } from "@forge/database";
import { DockerRuntime } from "@forge/docker";
import type { DeployJobData } from "@forge/types";
import type { IJobContext } from "@forge/queue";
import { DeploymentOrchestrator } from "../deployment-orchestrator.service.js";
import pino from "pino";

const logger = pino({
  name: "deploy-handler",
  level: process.env.LOG_LEVEL ?? "info",
});

export async function handleDeployJob(context: IJobContext<DeployJobData>): Promise<void> {
  const { deploymentId, projectId, image } = context.job.data;

  logger.info({ deploymentId, projectId, image }, "Processing deploy job");

  const db = getDatabaseClient();
  const runtime = new DockerRuntime();
  const orchestrator = new DeploymentOrchestrator(db, runtime, logger);

  try {
    await orchestrator.deploy(deploymentId, image);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ deploymentId, error: errorMessage }, "Deployment failed");

    // Orchestrator's handleFailure method updates the database
    // We only need to re-throw for queue retry logic
    throw error;
  }
}
