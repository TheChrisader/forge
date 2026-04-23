import { getDatabaseClient, type PrismaClient } from "@forge/database";
import { GitService, type GitProgressCallback } from "@forge/git";
import {
  getBuildStrategyRegistry,
  registerDefaultStrategies,
  type BuildContext,
  type BuildConfig,
  type BuildProgressCallback,
  generateImageName,
} from "@forge/build";
import type {
  BuildJobData,
  DeploymentStatus,
  LogLevel,
  BuildLogSource,
  DeployJobData,
  JobOptions,
} from "@forge/types";
import { ProjectConfigSchema, ProjectSourceType, toPrismaJson } from "@forge/types";
import type { IJobContext } from "@forge/queue";
import {
  BuildLogService,
  ForgeError,
  LocalPathNotFoundError,
  ImageValidationError,
  deepMerge,
} from "@forge/core";
import { getQueueService, type QueueConfig } from "@forge/queue";
import type { LogLevel as CoreLogLevel } from "@forge/core";
import { LoggerService } from "@forge/logger";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { withTimeout, TIMEOUTS } from "../timeouts/wrapper.js";
import { BuildErrorHandler } from "../error-handling/handler.js";
import { BuildMetricsService } from "../metrics/service.js";
import { PriorityLogBuffer, parseBufferSize, parseErrorSlotReserve } from "./log-buffer.js";
import { FlushManager, createFlushManagerOptions } from "./flush-manager.js";
import {
  emitProgress as sharedEmitProgress,
  initializeLineNumberRef,
} from "../../utils/progress-emitter.js";

const logger = new LoggerService({
  level: (process.env.LOG_LEVEL as CoreLogLevel) ?? "info",
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
  enabled: true,
  name: "build-handler",
});

function getDeployJobOptions(): JobOptions {
  return {
    attempts: Number.parseInt(process.env.DEPLOY_JOB_MAX_ATTEMPTS ?? "2", 10),
    backoff: {
      type: "exponential",
      delay: Number.parseInt(process.env.DEPLOY_JOB_BACKOFF_MS ?? "5000", 10),
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  };
}

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
function createGitProgressCallback(
  context: IJobContext<BuildJobData>,
  deploymentId: string,
  logBuffer: PriorityLogBuffer,
  lineNumberRef: { value: number }
): GitProgressCallback {
  return (event) => {
    void sharedEmitProgress(
      context,
      deploymentId,
      logBuffer,
      lineNumberRef,
      "BUILD" as BuildLogSource,
      logger,
      {
        message: event.message,
        level: event.type === "error" ? "ERROR" : "INFO",
        stage: event.stage ?? "git",
        progress: event.progress,
      }
    );
  };
}

async function acquireFromLocal(
  sourcePath: string,
  destinationPath: string,
  context: IJobContext<BuildJobData>,
  deploymentId: string,
  logBuffer: PriorityLogBuffer,
  lineNumberRef: { value: number }
): Promise<void> {
  await sharedEmitProgress(
    context,
    deploymentId,
    logBuffer,
    lineNumberRef,
    "BUILD" as BuildLogSource,
    logger,
    {
      message: `Copying files from local path: ${sourcePath}...`,
      stage: "local-copy",
    }
  );

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

    await sharedEmitProgress(
      context,
      deploymentId,
      logBuffer,
      lineNumberRef,
      "BUILD" as BuildLogSource,
      logger,
      {
        message: "Local files copied successfully",
        stage: "local-copy",
      }
    );
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
  logBuffer: PriorityLogBuffer,
  lineNumberRef: { value: number }
): Promise<void> {
  const { imageUrl, projectId } = context.job.data;

  logger.info("Processing pre-built image", { deploymentId, imageUrl });

  await sharedEmitProgress(
    context,
    deploymentId,
    logBuffer,
    lineNumberRef,
    "BUILD" as BuildLogSource,
    logger,
    {
      message: "Validating pre-built image...",
      stage: "image-validation",
    }
  );

  if (!imageUrl || !imageUrl.includes("/")) {
    throw new ImageValidationError(
      imageUrl ?? "missing",
      "Image must be in format 'registry/repository:tag'"
    );
  }

  await sharedEmitProgress(
    context,
    deploymentId,
    logBuffer,
    lineNumberRef,
    "BUILD" as BuildLogSource,
    logger,
    {
      message: `Image validated: ${imageUrl}`,
      stage: "image-validation",
      progress: 100,
    }
  );

  await db.deployment.update({
    where: { id: deploymentId },
    data: {
      status: "DEPLOYING" as DeploymentStatus,
      buildImage: imageUrl,
      buildCompletedAt: new Date(),
    },
  });

  const queueService = getQueueService(getQueueConfig());
  const deployJobData: DeployJobData = {
    deploymentId,
    projectId,
    image: imageUrl,
  };

  await queueService.addJob(
    "deploy",
    `deploy-container-${deploymentId}`,
    deployJobData,
    getDeployJobOptions()
  );

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

  const bufferMaxSize = parseBufferSize(process.env.BUILD_LOG_BUFFER_SIZE, 1000);
  const errorSlotReserve = parseErrorSlotReserve(process.env.BUILD_LOG_ERROR_SLOT_RESERVE, 0.1);

  const logBuffer = new PriorityLogBuffer({
    maxSize: bufferMaxSize,
    errorSlotReserve,
  });

  const lineNumberRef = await initializeLineNumberRef(buildLogService, deploymentId);

  logger.info("Build handler initialized", {
    deploymentId,
    startingLineNumber: lineNumberRef.value,
  });

  const flushManagerOptions = createFlushManagerOptions();
  const flushManager = new FlushManager(buildLogService, logger, flushManagerOptions);

  flushManager.scheduleFlush(logBuffer, deploymentId, () => {
    const stats = logBuffer.getStats();
    if (stats.droppedCount > 0) {
      logger.warn("Build logs have been dropped due to buffer pressure", {
        deploymentId,
        droppedCount: stats.droppedCount,
        droppedErrorCount: stats.droppedErrorCount,
        droppedGeneralCount: stats.droppedGeneralCount,
        utilizationPercent: stats.utilizationPercent.toFixed(1),
      });
    }
  });

  logger.info("Build log buffer configured", {
    deploymentId,
    maxSize: bufferMaxSize,
    errorLimit: logBuffer["errorLimit"],
    generalLimit: logBuffer["generalLimit"],
    flushRetryEnabled: flushManagerOptions.enabled,
    maxRetryAttempts: flushManagerOptions.maxRetryAttempts,
  });

  try {
    await metricsService.recordBuildStart(deploymentId);

    logger.info("Updating deployment status to BUILDING", { deploymentId });
    await db.deployment.update({
      where: { id: deploymentId },
      data: { status: "BUILDING" as DeploymentStatus },
    });

    let sourceDir: string;
    let gitProgressCallback: GitProgressCallback;

    switch (sourceType) {
      case ProjectSourceType.GIT:
        logger.info("Cloning repository...", {
          deploymentId,
          gitUrl: context.job.data.gitUrl,
          branch: context.job.data.branch,
          repoPath,
        });

        gitProgressCallback = createGitProgressCallback(
          context,
          deploymentId,
          logBuffer,
          lineNumberRef
        );

        await withTimeout(
          gitService.clone({
            url: context.job.data.gitUrl ?? "",
            branch: context.job.data.branch,
            destinationPath: repoPath,
            depth: 1,
            onProgress: gitProgressCallback,
          }),
          TIMEOUTS.GIT_CLONE,
          "Git clone"
        );

        if (context.job.data.gitCommit) {
          logger.info("Checking out specific commit", {
            deploymentId,
            gitCommit: context.job.data.gitCommit,
          });
          await gitService.checkoutCommit(
            repoPath,
            context.job.data.gitCommit,
            gitProgressCallback
          );
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

    const projectConfigParseResult = ProjectConfigSchema.safeParse(project.config);

    if (!projectConfigParseResult.success) {
      throw new ForgeError(
        "INVALID_PROJECT_CONFIG",
        400,
        `Invalid project config: ${projectConfigParseResult.error.message}`
      );
    }

    const projectConfig = projectConfigParseResult.data;

    const configUpdate: Partial<typeof projectConfig> = {
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

    const mergedConfig = deepMerge(projectConfig ?? {}, configUpdate);

    await db.project.update({
      where: { id: projectId },
      data: {
        type: strategy.name,
        config: toPrismaJson(mergedConfig),
      },
    });
    logger.info("Project updated with framework info", { deploymentId, projectId });

    const buildConfig: BuildConfig = {
      ...detectedConfig,
      installCommand: mergedConfig.build?.installCommand ?? detectedConfig.installCommand,
      buildCommand: mergedConfig.build?.buildCommand ?? detectedConfig.buildCommand,
      startCommand: mergedConfig.runtime?.startCommand ?? detectedConfig.startCommand,
      nodeVersion: mergedConfig.runtime?.nodeVersion ?? detectedConfig.nodeVersion,
      pythonVersion: mergedConfig.runtime?.pythonVersion ?? detectedConfig.pythonVersion,
      goVersion: mergedConfig.runtime?.goVersion ?? detectedConfig.goVersion,
      port: mergedConfig.runtime?.port ?? detectedConfig.port,
      envVars: mergedConfig.runtime?.env,
    };

    await sharedEmitProgress(
      context,
      deploymentId,
      logBuffer,
      lineNumberRef,
      "BUILD" as BuildLogSource,
      logger,
      {
        message: "Starting build process...",
        stage: "build",
      }
    );

    const progressCallback: BuildProgressCallback = (event) => {
      void sharedEmitProgress(
        context,
        deploymentId,
        logBuffer,
        lineNumberRef,
        "BUILD" as BuildLogSource,
        logger,
        {
          message: event.message,
          level: mapProgressTypeToLogLevel(event.type),
          stage: event.stage,
          progress: event.progress,
          log: event.log,
        }
      );
    };

    const result = await withTimeout(
      strategy.build(buildContext, buildConfig, progressCallback),
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

    const queueService = getQueueService(getQueueConfig());
    const deployJobData: DeployJobData = {
      deploymentId,
      projectId,
      image: imageTag,
    };

    await queueService.addJob(
      "deploy",
      `deploy-container-${deploymentId}`,
      deployJobData,
      getDeployJobOptions()
    );

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
    // Final flush before cleanup
    const finalResult = await flushManager.flush(logBuffer, deploymentId);
    flushManager.stop();

    // Log final buffer statistics
    const finalStats = logBuffer.getStats();
    logger.info("Build log buffer final statistics", {
      deploymentId,
      finalFlushSuccess: finalResult.success,
      totalEntriesProcessed: finalResult.entryCount,
      currentBufferSize: finalStats.currentSize,
      totalDropped: finalStats.droppedCount,
      droppedErrors: finalStats.droppedErrorCount,
      droppedGeneral: finalStats.droppedGeneralCount,
      circuitBreakerOpened: finalResult.circuitBreakerOpen,
      consecutiveFailures: finalResult.consecutiveFailures,
    });

    await cleanupBuildDir(repoPath);
  }
}
