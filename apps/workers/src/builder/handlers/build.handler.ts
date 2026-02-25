import { getDatabaseClient, type PrismaClient } from "@forge/database";
import { GitService } from "@forge/git";
import {
  getBuildStrategyRegistry,
  registerDefaultStrategies,
  type BuildContext,
  type BuildProgressEvent,
} from "@forge/build";
import type { BuildJobData, DeploymentStatus, LogLevel, BuildLogSource } from "@forge/types";
import { ProjectSourceType } from "@forge/types";
import {
  BuildLogService,
  ForgeError,
  LocalPathNotFoundError,
  ImageValidationError,
  type BuildLogEntry,
} from "@forge/core";
import { EventEmitter } from "eventemitter3";
import pino from "pino";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { withTimeout, TIMEOUTS } from "../timeouts/wrapper.js";
import { BuildErrorHandler } from "../error-handling/handler.js";
import { BuildMetricsService } from "../metrics/service.js";

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

async function acquireFromLocal(
  sourcePath: string,
  destinationPath: string,
  emitter: EventEmitter
): Promise<void> {
  emitter.emit("progress", {
    type: "log",
    message: `Copying files from local path: ${sourcePath}...`,
    timestamp: new Date(),
    stage: "local-copy",
  } as BuildProgressEvent);

  try {
    const stats = await fs.stat(sourcePath);
    if (!stats.isDirectory()) {
      throw new LocalPathNotFoundError(sourcePath, "Source path must be a directory");
    }

    await fs.access(sourcePath, fs.constants.R_OK);

    await fs.mkdir(destinationPath, { recursive: true });

    await fs.cp(sourcePath, destinationPath, {
      recursive: true,
      filter: (src) => {
        const basename = path.basename(src);
        return !["node_modules", ".git", "dist", "build", ".env"].includes(basename);
      },
    });

    emitter.emit("progress", {
      type: "log",
      message: "Local files copied successfully",
      timestamp: new Date(),
      stage: "local-copy",
    } as BuildProgressEvent);
  } catch (error) {
    if (error instanceof ForgeError) {
      throw error;
    }
    throw new LocalPathNotFoundError(sourcePath, error);
  }
}

async function handlePreBuiltImage(
  data: BuildJobData,
  deploymentId: string,
  db: PrismaClient,
  emitter: EventEmitter,
  logger: pino.Logger
): Promise<void> {
  const { imageUrl } = data;

  logger.info({ deploymentId, imageUrl }, "Processing pre-built image");

  emitter.emit("progress", {
    type: "stage",
    message: "Validating pre-built image...",
    timestamp: new Date(),
    stage: "image-validation",
  } as BuildProgressEvent);

  if (!imageUrl || !imageUrl.includes("/")) {
    throw new ImageValidationError(
      imageUrl ?? "missing",
      "Image must be in format 'registry/repository:tag'"
    );
  }

  emitter.emit("progress", {
    type: "complete",
    message: `Image validated: ${imageUrl}`,
    timestamp: new Date(),
    stage: "image-validation",
  } as BuildProgressEvent);

  await db.deployment.update({
    where: { id: deploymentId },
    data: {
      status: "SUCCEEDED" as DeploymentStatus,
      buildImage: imageUrl,
      buildCompletedAt: new Date(),
    },
  });

  // TODO: Enqueue deploy job directly when deployer worker is implemented
  // await queueService.addJob("deploy", "deploy-image", {
  //   deploymentId,
  //   projectId: data.projectId,
  //   image: imageUrl,
  // });

  logger.info({ deploymentId, imageUrl }, "Pre-built image ready for deployment");
}

export async function handleBuildJob(job: Job<BuildJobData>): Promise<void> {
  const { deploymentId, projectId } = job.data;

  const sourceType = job.data.sourceType ?? ProjectSourceType.GIT;

  logger.info({ deploymentId, projectId, sourceType }, "Processing build job");

  registerDefaultStrategies();

  const db = getDatabaseClient();
  const gitService = new GitService();
  const strategyRegistry = getBuildStrategyRegistry();
  const buildLogService = new BuildLogService(db);

  const errorHandler = new BuildErrorHandler();
  const metricsService = new BuildMetricsService(db);

  const buildDir = process.env.FORGE_BUILD_DIR ?? "/tmp/forge-builds";
  await ensureBuildDir(buildDir);

  const repoPath = `${buildDir}/${deploymentId}`;

  const emitter = new EventEmitter();
  const buildLogs: string[] = [];

  let lineNumber = 0;
  const logBuffer: BuildLogEntry[] = [];

  const flushLogs = async (): Promise<void> => {
    if (logBuffer.length === 0) return;
    try {
      await buildLogService.appendBatch([...logBuffer]);
      logBuffer.length = 0;
    } catch (error) {
      logger.error({ error, deploymentId }, "Failed to flush logs to database");
    }
  };

  const flushInterval = setInterval(flushLogs, 2000);

  emitter.on("progress", (progress: BuildProgressEvent) => {
    if (!progress.message) return;

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

    logBuffer.push({
      deploymentId,
      lineNumber: lineNumber++,
      timestamp: new Date(),
      level: mapProgressTypeToLogLevel(progress.type),
      message: progress.message,
      source: "BUILD" as BuildLogSource,
    });

    if (logBuffer.length >= 50) {
      void flushLogs();
    }
  });

  try {
    await metricsService.recordBuildStart(deploymentId);

    logger.info({ deploymentId }, "Updating deployment status to BUILDING");
    await db.deployment.update({
      where: { id: deploymentId },
      data: { status: "BUILDING" as DeploymentStatus },
    });

    let sourceDir: string;

    switch (sourceType) {
      case ProjectSourceType.GIT:
        logger.info({ deploymentId, gitUrl: job.data.gitUrl, repoPath }, "Cloning repository...");
        await withTimeout(
          gitService.clone({
            url: job.data.gitUrl ?? "",
            branch: job.data.branch,
            destinationPath: repoPath,
            depth: 1,
          }),
          TIMEOUTS.GIT_CLONE,
          "Git clone"
        );
        sourceDir = repoPath;
        logger.info({ deploymentId }, "Repository cloned successfully");
        break;

      case ProjectSourceType.LOCAL:
        logger.info({ deploymentId, localPath: job.data.localPath }, "Copying local files...");
        await withTimeout(
          acquireFromLocal(job.data.localPath ?? "", repoPath, emitter),
          TIMEOUTS.GIT_CLONE, // Same timeout as git clone
          "Local file copy"
        );
        sourceDir = repoPath;
        logger.info({ deploymentId }, "Local files copied successfully");
        break;

      case ProjectSourceType.IMAGE:
        await handlePreBuiltImage(job.data, deploymentId, db, emitter, logger);
        return;

      case ProjectSourceType.DOCKER_COMPOSE:
        throw new ForgeError(
          "DOCKER_COMPOSE_NOT_SUPPORTED",
          501,
          "Docker Compose deployments are not yet supported. A separate compose worker will be implemented."
        );

      default:
        throw new ForgeError("INVALID_SOURCE_TYPE", 400, `Unsupported source type: ${sourceType}`);
    }

    const buildContext: BuildContext = {
      projectId,
      deploymentId,
      workDir: buildDir,
      sourceDir: sourceDir,
      outputDir: `${buildDir}/${deploymentId}/output`,
    };

    logger.info({ deploymentId }, "Detecting framework...");
    const strategy = await withTimeout(
      strategyRegistry.detect(buildContext),
      TIMEOUTS.FRAMEWORK_DETECT,
      "Framework detection"
    );

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

    const result = await withTimeout(
      strategy.build(buildContext, config, emitter),
      TIMEOUTS.DOCKER_BUILD,
      "Docker build"
    );

    logger.info(
      {
        deploymentId,
        success: result.success,
        duration: result.duration,
      },
      "Build completed"
    );

    await metricsService.recordBuildComplete({
      deploymentId,
      projectId,
      startedAt: new Date(Date.now() - (result.duration ?? 0)),
      completedAt: new Date(),
      status: "SUCCEEDED" as DeploymentStatus,
    });

    await db.deployment.update({
      where: { id: deploymentId },
      data: {
        status: "SUCCEEDED" as DeploymentStatus,
        buildCompletedAt: new Date(),
      },
    });

    logger.info({ deploymentId }, "Deployment marked as COMPLETED");
  } catch (error) {
    await errorHandler.handle({
      deploymentId,
      projectId,
      logger,
      db,
      error,
    });
  } finally {
    await flushLogs();
    clearInterval(flushInterval);
    await cleanupBuildDir(repoPath);
  }
}
