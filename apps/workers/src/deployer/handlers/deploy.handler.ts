/**
 * Deploy Job Handler
 *
 * Processes deploy jobs from the queue and coordinates container deployment.
 */

import { getDatabaseClient } from "@forge/database";
import { DockerRuntime } from "@forge/docker";
import type { DeployJobData } from "@forge/types";
import { DeploymentOrchestrator } from "../deployment-orchestrator.service.js";
import pino from "pino";

interface Job<T = unknown> {
  id?: string;
  name: string;
  data: T;
}

const logger = pino({
  name: "deploy-handler",
  level: process.env.LOG_LEVEL ?? "info",
});

/**
 * Main handler for deploy jobs from the queue
 */
export async function handleDeployJob(job: Job<DeployJobData>): Promise<void> {
  const { deploymentId, projectId, image } = job.data;

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
