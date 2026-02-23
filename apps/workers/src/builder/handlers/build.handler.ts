/**
 * Build job handler
 * Processes individual build jobs from the queue
 */

import { getDatabaseClient } from "@forge/database";
import { GitService } from "@forge/git";
import {
  getBuildStrategyRegistry,
  registerDefaultStrategies,
  type BuildContext,
} from "@forge/build";
import type { BuildJobData, DeploymentStatus } from "@forge/types";
import { BuildError } from "@forge/core";
import pino from "pino";
import * as fs from "node:fs/promises";

/**
 * Minimal Job interface for queue job processing
 * Matches the bullmq Job interface signature used by JobProcessor
 */
interface Job<T = unknown> {
  id?: string;
  name: string;
  data: T;
}

const logger = pino({
  name: "build-handler",
  level: process.env.LOG_LEVEL ?? "info",
});

/**
 * Ensure build directory exists
 */
async function ensureBuildDir(buildDir: string): Promise<void> {
  try {
    await fs.mkdir(buildDir, { recursive: true });
  } catch (error) {
    logger.error({ error, buildDir }, "Failed to create build directory");
    throw error;
  }
}

/**
 * Clean up build artifacts
 */
async function cleanupBuildDir(repoPath: string): Promise<void> {
  try {
    await fs.rm(repoPath, { recursive: true, force: true });
  } catch (error) {
    // Log but don't throw - cleanup failures shouldn't fail the build
    logger.warn({ error, repoPath }, "Failed to clean up build directory");
  }
}

/**
 * Handle build job
 */
export async function handleBuildJob(job: Job<BuildJobData>): Promise<void> {
  const { deploymentId, projectId, gitUrl, branch } = job.data;

  logger.info({ deploymentId, projectId, gitUrl, branch }, "Processing build job");

  // Register strategies if not already registered
  registerDefaultStrategies();

  const db = getDatabaseClient();
  const gitService = new GitService();
  const strategyRegistry = getBuildStrategyRegistry();

  // Use a consistent build directory
  const buildDir = process.env.FORGE_BUILD_DIR ?? "/tmp/forge-builds";
  await ensureBuildDir(buildDir);

  const repoPath = `${buildDir}/${deploymentId}`;

  try {
    // Step 1: Update deployment to "BUILDING"
    logger.info({ deploymentId }, "Updating deployment status to BUILDING");
    await db.deployment.update({
      where: { id: deploymentId },
      data: { status: "BUILDING" as DeploymentStatus },
    });

    // Step 2: Clone the repo
    logger.info({ deploymentId, gitUrl, repoPath }, "Cloning repository...");
    await gitService.clone({
      url: gitUrl ?? "",
      branch,
      destinationPath: repoPath,
      depth: 1,
    });
    logger.info({ deploymentId }, "Repository cloned successfully");

    // Step 3: Detect framework using build strategy registry
    const buildContext: BuildContext = {
      projectId,
      deploymentId,
      workDir: buildDir,
      sourceDir: repoPath,
      outputDir: `${buildDir}/${deploymentId}/output`,
    };

    logger.info({ deploymentId }, "Detecting framework...");
    const strategy = await strategyRegistry.detect(buildContext);

    if (!strategy) {
      throw new BuildError("Unable to detect project framework", {
        projectId,
        deploymentId,
      });
    }

    const detectionResult = await strategy.detect(buildContext);
    logger.info(
      {
        deploymentId,
        framework: detectionResult.framework,
        confidence: detectionResult.confidence,
      },
      "Framework detected"
    );

    // Step 4: Update project with detected framework info
    const config = detectionResult.config ?? strategy.getDefaultConfig();

    await db.project.update({
      where: { id: projectId },
      data: {
        type: strategy.name,
        config: {
          buildCommand: config.buildCommand,
          startCommand: config.startCommand,
          installCommand: config.installCommand,
          port: config.port,
        },
      },
    });
    logger.info({ deploymentId, projectId }, "Project updated with framework info");

    // Step 5 (Sprint 2 stub): Mark as COMPLETED immediately
    // TODO Sprint 3: Actually build the Docker image here
    logger.info({ deploymentId }, "Build completed (stub implementation)");

    await db.deployment.update({
      where: { id: deploymentId },
      data: {
        status: "COMPLETED" as DeploymentStatus,
        buildCompletedAt: new Date(),
      },
    });

    logger.info({ deploymentId }, "Deployment marked as COMPLETED");
  } catch (error) {
    logger.error(
      { deploymentId, error: error instanceof Error ? error.message : error },
      "Build failed"
    );

    // Always update deployment status on failure
    try {
      await db.deployment.update({
        where: { id: deploymentId },
        data: {
          status: "FAILED" as DeploymentStatus,
          buildCompletedAt: new Date(),
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    } catch (dbError) {
      logger.error({ deploymentId, dbError }, "Failed to update deployment status");
    }

    throw error; // BullMQ will retry based on job options
  } finally {
    // Clean up cloned repo
    await cleanupBuildDir(repoPath);
  }
}
