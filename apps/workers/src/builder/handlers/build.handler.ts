import { getDatabaseClient, type PrismaClient } from "@forge/database";
import { GitService } from "@forge/git";
import {
  getBuildStrategyRegistry,
  registerDefaultStrategies,
  type BuildContext,
  type BuildProgressCallback,
  generateImageName,
} from "@forge/build";
import type {
  BuildJobData,
  DeploymentStatus,
  LogLevel,
  BuildLogSource,
  DeployJobData,
} from "@forge/types";
import { ProjectSourceType } from "@forge/types";
import type { IJobContext } from "@forge/queue";
import {
  BuildLogService,
  ForgeError,
  LocalPathNotFoundError,
  ImageValidationError,
  deepMerge,
  type BuildLogEntry,
} from "@forge/core";
import { QueueService, type QueueConfig } from "@forge/queue";
import type { LogLevel as CoreLogLevel } from "@forge/core";
import { LoggerService } from "@forge/logger";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { withTimeout, TIMEOUTS } from "../timeouts/wrapper.js";
import { BuildErrorHandler } from "../error-handling/handler.js";
import { BuildMetricsService } from "../metrics/service.js";

const logger = new LoggerService({
  level: (process.env.LOG_LEVEL as CoreLogLevel) ?? "info",
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
  enabled: true,
  name: "build-handler",
});

function getQueueConfig(): QueueConfig {
  return {
    connection: {
      type: "redis",
      redis: {
        host: process.env.REDIS_HOST ?? "localhost",
        port: Number.parseInt(process.env.REDIS_PORT ?? "6379", 10),
        password: process.env.REDIS_PASSWORD,
        db: Number.parseInt(process.env.REDIS_DB ?? "0", 10),
      },
    },
  };
}

async function ensureBuildDir(buildDir: string): Promise<void> {
  try {
    await fs.mkdir(buildDir, { recursive: true });
  } catch (error) {
    logger.error("Failed to create build directory", { error, buildDir });
    throw error;
  }
}

async function cleanupBuildDir(repoPath: string): Promise<void> {
  try {
    await fs.rm(repoPath, { recursive: true, force: true });
  } catch (error) {
    // Log but don't throw - cleanup failures shouldn't fail the build
    logger.warn("Failed to clean up build directory", { error, repoPath });
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

interface EmitProgressOptions {
  message: string;
  level?: LogLevel;
  stage?: string;
  progress?: number;
}

/**
 * Helper function to emit progress events through BullMQ and buffer for database logging
 * Creates a single source of truth for progress emissions
 */
async function emitProgress(
  context: IJobContext<BuildJobData>,
  deploymentId: string,
  logBuffer: BuildLogEntry[],
  lineNumberRef: { value: number },
  options: EmitProgressOptions
): Promise<void> {
  const lineNum = lineNumberRef.value++;

  await context.updateProgress({
    type: "deployment.log",
    deploymentId,
    data: {
      lineNumber: lineNum,
      timestamp: new Date().toISOString(),
      level: (options.level ?? "INFO") as LogLevel,
      source: "BUILD",
      message: options.message,
      stage: options.stage,
      progress: options.progress,
    },
  });

  logger.info(options.message, {
    deploymentId,
    type: options.stage ?? "log",
    stage: options.stage,
    progress: options.progress,
    level: options.level ?? "INFO",
  });

  logBuffer.push({
    deploymentId,
    lineNumber: lineNum,
    timestamp: new Date(),
    level: (options.level ?? "INFO") as LogLevel,
    message: options.message,
    source: "BUILD" as BuildLogSource,
  });
}

async function acquireFromLocal(
  sourcePath: string,
  destinationPath: string,
  context: IJobContext<BuildJobData>,
  deploymentId: string,
  logBuffer: BuildLogEntry[],
  lineNumberRef: { value: number }
): Promise<void> {
  await emitProgress(context, deploymentId, logBuffer, lineNumberRef, {
    message: `Copying files from local path: ${sourcePath}...`,
    stage: "local-copy",
  });

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

    await emitProgress(context, deploymentId, logBuffer, lineNumberRef, {
      message: "Local files copied successfully",
      stage: "local-copy",
    });
  } catch (error) {
    if (error instanceof ForgeError) {
      throw error;
    }
    throw new LocalPathNotFoundError(sourcePath, error);
  }
}

async function handlePreBuiltImage(
  context: IJobContext<BuildJobData>,
  deploymentId: string,
  db: PrismaClient,
  logBuffer: BuildLogEntry[],
  lineNumberRef: { value: number }
): Promise<void> {
  const { imageUrl, projectId } = context.job.data;

  logger.info("Processing pre-built image", { deploymentId, imageUrl });

  await emitProgress(context, deploymentId, logBuffer, lineNumberRef, {
    message: "Validating pre-built image...",
    stage: "image-validation",
  });

  if (!imageUrl || !imageUrl.includes("/")) {
    throw new ImageValidationError(
      imageUrl ?? "missing",
      "Image must be in format 'registry/repository:tag'"
    );
  }

  await emitProgress(context, deploymentId, logBuffer, lineNumberRef, {
    message: `Image validated: ${imageUrl}`,
    stage: "image-validation",
    progress: 100,
  });

  await db.deployment.update({
    where: { id: deploymentId },
    data: {
      status: "DEPLOYING" as DeploymentStatus,
      buildImage: imageUrl,
      buildCompletedAt: new Date(),
    },
  });

  const queueService = new QueueService(getQueueConfig());
  const deployJobData: DeployJobData = {
    deploymentId,
    projectId,
    image: imageUrl,
  };

  await queueService.addJob("deploy", "deploy-container", deployJobData);
  await queueService.close();

  logger.info("Pre-built image ready for deployment, deploy job enqueued", {
    deploymentId,
    imageUrl,
  });
}

export async function handleBuildJob(context: IJobContext<BuildJobData>): Promise<void> {
  const { deploymentId, projectId } = context.job.data;

  const sourceType = context.job.data.sourceType ?? ProjectSourceType.GIT;

  logger.info("Processing build job", { deploymentId, projectId, sourceType });

  registerDefaultStrategies();

  const db = getDatabaseClient();

  // Fetch project to get the name and config for image generation and merging
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, config: true },
  });

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const gitService = new GitService();
  const strategyRegistry = getBuildStrategyRegistry();
  const buildLogService = new BuildLogService(db);

  const errorHandler = new BuildErrorHandler();
  const metricsService = new BuildMetricsService(db);

  const buildDir = process.env.FORGE_BUILD_DIR ?? path.join(os.tmpdir(), "forge-builds");
  await ensureBuildDir(buildDir);

  const repoPath = `${buildDir}/${deploymentId}`;

  const logBuffer: BuildLogEntry[] = [];
  const lineNumberRef = { value: 0 };

  const flushLogs = async (): Promise<void> => {
    if (logBuffer.length === 0) return;
    try {
      await buildLogService.appendBatch([...logBuffer]);
      logBuffer.length = 0;
    } catch (error) {
      logger.error("Failed to flush logs to database", { error, deploymentId });
    }
  };

  const flushInterval = setInterval(flushLogs, 2000);

  try {
    await metricsService.recordBuildStart(deploymentId);

    logger.info("Updating deployment status to BUILDING", { deploymentId });
    await db.deployment.update({
      where: { id: deploymentId },
      data: { status: "BUILDING" as DeploymentStatus },
    });

    let sourceDir: string;

    switch (sourceType) {
      case ProjectSourceType.GIT:
        logger.info("Cloning repository...", {
          deploymentId,
          gitUrl: context.job.data.gitUrl,
          branch: context.job.data.branch,
          repoPath,
        });
        await withTimeout(
          gitService.clone({
            url: context.job.data.gitUrl ?? "",
            branch: context.job.data.branch,
            destinationPath: repoPath,
            depth: 1,
          }),
          TIMEOUTS.GIT_CLONE,
          "Git clone"
        );

        if (context.job.data.gitCommit) {
          logger.info("Checking out specific commit", {
            deploymentId,
            gitCommit: context.job.data.gitCommit,
          });
          await gitService.checkoutCommit(repoPath, context.job.data.gitCommit);
          logger.info("Checked out specific commit successfully", { deploymentId });
        }

        sourceDir = repoPath;
        logger.info("Repository cloned successfully", { deploymentId });
        break;

      case ProjectSourceType.LOCAL:
        logger.info("Copying local files...", {
          deploymentId,
          localPath: context.job.data.localPath,
        });
        await withTimeout(
          acquireFromLocal(
            context.job.data.localPath ?? "",
            repoPath,
            context,
            deploymentId,
            logBuffer,
            lineNumberRef
          ),
          TIMEOUTS.GIT_CLONE,
          "Local file copy"
        );
        sourceDir = repoPath;
        logger.info("Local files copied successfully", { deploymentId });
        break;

      case ProjectSourceType.IMAGE:
        await handlePreBuiltImage(context, deploymentId, db, logBuffer, lineNumberRef);
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
      projectName: project.name,
      deploymentId,
      workDir: buildDir,
      sourceDir: sourceDir,
      outputDir: `${buildDir}/${deploymentId}`,
    };

    logger.info("Detecting framework...", { deploymentId });
    const strategy = await withTimeout(
      strategyRegistry.detect(buildContext),
      TIMEOUTS.FRAMEWORK_DETECT,
      "Framework detection"
    );

    const detectionResult = await strategy.detect(buildContext);
    logger.info("Framework detected", {
      deploymentId,
      framework: detectionResult.framework,
      confidence: detectionResult.confidence,
    });

    const detectedConfig = detectionResult.config ?? strategy.getDefaultConfig();

    // Build the partial config update from detected framework settings
    const configUpdate: Partial<typeof project.config> = {
      build: {
        buildCommand: detectedConfig.buildCommand,
        installCommand: detectedConfig.installCommand,
        framework: detectionResult.framework,
      },
      runtime: {
        startCommand: detectedConfig.startCommand,
        port: detectedConfig.port,
      },
    };

    // Deep merge detected config with existing project config to preserve user settings
    const mergedConfig = deepMerge(project.config ?? {}, configUpdate);

    await db.project.update({
      where: { id: projectId },
      data: {
        type: strategy.name,
        config: mergedConfig,
      },
    });
    logger.info("Project updated with framework info", { deploymentId, projectId });

    await emitProgress(context, deploymentId, logBuffer, lineNumberRef, {
      message: "Starting build process...",
      stage: "build",
    });

    const progressCallback: BuildProgressCallback = (event) => {
      void emitProgress(context, deploymentId, logBuffer, lineNumberRef, {
        message: event.message,
        level: mapProgressTypeToLogLevel(event.type),
        stage: event.stage,
        progress: event.progress,
      });
    };

    const result = await withTimeout(
      strategy.build(buildContext, detectedConfig, progressCallback),
      TIMEOUTS.DOCKER_BUILD,
      "Docker build"
    );

    logger.info("Build completed", {
      deploymentId,
      success: result.success,
      duration: result.duration,
    });

    await metricsService.recordBuildComplete({
      deploymentId,
      projectId,
      startedAt: new Date(Date.now() - (result.duration ?? 0)),
      completedAt: new Date(),
      status: "SUCCEEDED" as DeploymentStatus,
    });

    const imageTag = result.image ?? generateImageName(project.name, deploymentId);

    await db.deployment.update({
      where: { id: deploymentId },
      data: {
        status: "DEPLOYING" as DeploymentStatus,
        buildCompletedAt: new Date(),
        buildImage: imageTag,
      },
    });

    const queueService = new QueueService(getQueueConfig());
    const deployJobData: DeployJobData = {
      deploymentId,
      projectId,
      image: imageTag,
    };

    await queueService.addJob("deploy", "deploy-container", deployJobData);
    await queueService.close();

    logger.info("Build completed, deploy job enqueued", { deploymentId, imageTag });
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
