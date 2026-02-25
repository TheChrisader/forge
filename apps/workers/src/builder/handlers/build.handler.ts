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
  type BuildProgressEvent,
} from "@forge/build";
import type { BuildJobData, DeploymentStatus, LogLevel, BuildLogSource } from "@forge/types";
import { BuildLogService, type BuildLogEntry } from "@forge/core";
import { EventEmitter } from "eventemitter3";
import pino from "pino";
import * as fs from "node:fs/promises";

interface Job<T = unknown> {
  id?: string;
  name: string;
  data: T;
}

const logger = pino({
  name: "build-handler",
  level: process.env.LOG_LEVEL ?? "info",
});

async function ensureBuildDir(buildDir: string): Promise<void> {
  try {
    await fs.mkdir(buildDir, { recursive: true });
  } catch (error) {
    logger.error({ error, buildDir }, "Failed to create build directory");
    throw error;
  }
}

async function cleanupBuildDir(repoPath: string): Promise<void> {
  try {
    await fs.rm(repoPath, { recursive: true, force: true });
  } catch (error) {
    // Log but don't throw - cleanup failures shouldn't fail the build
    logger.warn({ error, repoPath }, "Failed to clean up build directory");
  }
}

function mapProgressTypeToLogLevel(type: string): LogLevel {
  switch (type) {
    case "error":
      return "ERROR" as LogLevel;
    case "stage":
      return "INFO" as LogLevel;
    case "step":
      return "DEBUG" as LogLevel;
    default:
      return "INFO" as LogLevel;
  }
}

export async function handleBuildJob(job: Job<BuildJobData>): Promise<void> {
  const { deploymentId, projectId, gitUrl, branch } = job.data;

  logger.info({ deploymentId, projectId, gitUrl, branch }, "Processing build job");

  // Register strategies if not already registered
  registerDefaultStrategies();

  const db = getDatabaseClient();
  const gitService = new GitService();
  const strategyRegistry = getBuildStrategyRegistry();

  // Initialize BuildLogService for durable log storage
  const buildLogService = new BuildLogService(db);

  // Use a consistent build directory
  const buildDir = process.env.FORGE_BUILD_DIR ?? "/tmp/forge-builds";
  await ensureBuildDir(buildDir);

  const repoPath = `${buildDir}/${deploymentId}`;

  // Create EventEmitter for progress reporting
  const emitter = new EventEmitter();
  const buildLogs: string[] = [];

  // Log buffer for batching database writes
  let lineNumber = 0;
  const logBuffer: BuildLogEntry[] = [];

  const flushLogs = async (): Promise<void> => {
    if (logBuffer.length === 0) return;
    try {
      await buildLogService.appendBatch([...logBuffer]);
      logBuffer.length = 0;
    } catch (error) {
      logger.error({ error, deploymentId }, "Failed to flush logs to database");
      // Don't throw - log failures shouldn't fail the build
    }
  };

  // Flush every 2 seconds
  const flushInterval = setInterval(flushLogs, 2000);

  // Listen to progress events for logging
  emitter.on("progress", (progress: BuildProgressEvent) => {
    if (!progress.message) return;

    // Existing in-memory logging (keep this)
    const logEntry = `[${progress.type.toUpperCase()}] ${progress.message}`;
    buildLogs.push(logEntry);

    logger.info(
      {
        deploymentId,
        type: progress.type,
        stage: progress.stage,
        progress: progress.progress,
      },
      progress.message
    );

    // NEW: Also buffer for database persistence
    logBuffer.push({
      deploymentId,
      lineNumber: lineNumber++,
      timestamp: new Date(),
      level: mapProgressTypeToLogLevel(progress.type),
      message: progress.message,
      source: "BUILD" as BuildLogSource,
    });

    // Flush immediately if buffer gets large
    if (logBuffer.length >= 50) {
      void flushLogs();
    }
  });

  try {
    logger.info({ deploymentId }, "Updating deployment status to BUILDING");
    await db.deployment.update({
      where: { id: deploymentId },
      data: { status: "BUILDING" as DeploymentStatus },
    });

    logger.info({ deploymentId, gitUrl, repoPath }, "Cloning repository...");
    await gitService.clone({
      url: gitUrl ?? "",
      branch,
      destinationPath: repoPath,
      depth: 1,
    });
    logger.info({ deploymentId }, "Repository cloned successfully");

    const buildContext: BuildContext = {
      projectId,
      deploymentId,
      workDir: buildDir,
      sourceDir: repoPath,
      outputDir: `${buildDir}/${deploymentId}/output`,
    };

    logger.info({ deploymentId }, "Detecting framework...");
    // No null check needed - throws NoStrategyFoundError if not found
    const strategy = await strategyRegistry.detect(buildContext);

    const detectionResult = await strategy.detect(buildContext);
    logger.info(
      {
        deploymentId,
        framework: detectionResult.framework,
        confidence: detectionResult.confidence,
      },
      "Framework detected"
    );

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

    emitter.emit("progress", {
      type: "stage",
      message: "Starting build process...",
      timestamp: new Date(),
      stage: "build",
    } as BuildProgressEvent);

    const result = await strategy.build(buildContext, config, emitter);

    logger.info(
      {
        deploymentId,
        success: result.success,
        duration: result.duration,
      },
      "Build completed"
    );

    await db.deployment.update({
      where: { id: deploymentId },
      data: {
        status: "SUCCEEDED" as DeploymentStatus,
        buildCompletedAt: new Date(),
      },
    });

    logger.info({ deploymentId }, "Deployment marked as COMPLETED");
  } catch (error) {
    logger.error(
      { deploymentId, error: error instanceof Error ? error.message : error },
      "Build failed"
    );

    // On error, also log the error message to the database
    try {
      await buildLogService.append({
        deploymentId,
        lineNumber: lineNumber++,
        timestamp: new Date(),
        level: "ERROR" as LogLevel,
        message: error instanceof Error ? error.message : "Build failed",
        source: "SYSTEM" as BuildLogSource,
      });
    } catch (logError) {
      logger.error({ error: logError, deploymentId }, "Failed to log error to database");
    }

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

    throw error;
  } finally {
    // Flush any remaining logs before cleanup
    await flushLogs();
    clearInterval(flushInterval);

    await cleanupBuildDir(repoPath);
  }
}
