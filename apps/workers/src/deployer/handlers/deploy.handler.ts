import { getDatabaseClient } from "@forge/database";
import { DockerRuntime } from "@forge/docker";
import type { DeployJobData } from "@forge/types";
import type { IJobContext, QueueConfig } from "@forge/queue";
import { LoggerService } from "@forge/logger";
import type { LogLevel } from "@forge/types";
import { BuildLogService } from "@forge/core";
import type { BuildLogSource } from "@forge/types";
import type { IProxyIntegration } from "@forge/proxy";
import { ContainerLifecycle } from "@forge/deploy";
import { createDefaultStrategyRegistry } from "@forge/deploy";
import { RedisDeployLock } from "@forge/queue";
import { PriorityLogBuffer, parseBufferSize, parseErrorSlotReserve } from "./log-buffer.js";
import { FlushManager, createFlushManagerOptions } from "./flush-manager.js";
import type { DeployProgressCallback } from "../deployment-orchestrator.service.js";
import { DeploymentOrchestrator } from "../deployment-orchestrator.service.js";
import { emitProgress, initializeLineNumberRef } from "../../utils/progress-emitter.js";

const logger = new LoggerService({
  level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
  enabled: true,
  name: "deploy-handler",
});

const LOCK_TTL_MS = Number.parseInt(process.env.DEPLOY_LOCK_TTL_MS ?? "300000", 10);

export async function handleDeployJob(
  context: IJobContext<DeployJobData>,
  proxyIntegration: IProxyIntegration,
  runtime: DockerRuntime,
  queueConfig: QueueConfig
): Promise<void> {
  const { deploymentId, projectId, image } = context.job.data;

  logger.info("Processing deploy job", { deploymentId, projectId, image });

  // Acquire distributed lock for this deployment to prevent concurrent processing
  const lock = createDeployLock(queueConfig);
  let lockToken: string | null = null;
  let projectLockToken: string | null = null;

  try {
    lockToken = await lock.acquire(deploymentId, LOCK_TTL_MS);
    if (!lockToken) {
      logger.warn("Deploy lock already held — skipping duplicate job", {
        deploymentId,
        attemptsMade: context.job.attemptsMade,
      });
      return;
    }

    projectLockToken = await lock.acquireProjectLock(projectId, LOCK_TTL_MS);
    if (!projectLockToken) {
      logger.warn("Project deploy lock already held — skipping concurrent project deploy", {
        deploymentId,
        projectId,
      });
      await lock.release(deploymentId, lockToken);
      return;
    }

    logger.info("Deploy locks acquired", { deploymentId, projectId });

    // Pre-flight cleanup on retry: remove leftover containers from previous attempts
    if (context.job.attemptsMade > 0) {
      await cleanupLeftoverContainers(deploymentId, runtime);
    }

    await executeDeploy(
      context,
      deploymentId,
      projectId,
      image,
      proxyIntegration,
      runtime,
      lock,
      lockToken,
      projectLockToken
    );
  } catch (error) {
    if (!lockToken) {
      // Lock acquisition itself failed unexpectedly (not "already held")
      throw error;
    }
    throw error;
  } finally {
    if (projectLockToken) {
      await lock.releaseProjectLock(projectId, projectLockToken);
    }
    if (lockToken) {
      await lock.release(deploymentId, lockToken);
    }
  }
}

async function executeDeploy(
  context: IJobContext<DeployJobData>,
  deploymentId: string,
  projectId: string,
  image: string,
  proxyIntegration: IProxyIntegration,
  runtime: DockerRuntime,
  lock: RedisDeployLock,
  lockToken: string,
  projectLockToken: string
): Promise<void> {
  const db = getDatabaseClient();
  const buildLogService = new BuildLogService(db);

  const lifecycle = new ContainerLifecycle(db, runtime, logger, proxyIntegration);
  const strategyRegistry = createDefaultStrategyRegistry(lifecycle, logger);

  const encryptionKey = process.env.SECRETS_ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY environment variable is required for deploy handler");
  }

  const orchestrator = new DeploymentOrchestrator(
    db,
    strategyRegistry,
    lifecycle,
    logger,
    proxyIntegration,
    encryptionKey
  );

  const lineNumberRef = await initializeLineNumberRef(buildLogService, deploymentId);

  logger.info("Deploy handler initialized", {
    deploymentId,
    lastLineNumber: lineNumberRef.value,
  });

  const bufferMaxSize = parseBufferSize(process.env.DEPLOY_LOG_BUFFER_SIZE, 500);
  const errorSlotReserve = parseErrorSlotReserve(process.env.DEPLOY_LOG_ERROR_SLOT_RESERVE, 0.1);

  const logBuffer = new PriorityLogBuffer({
    maxSize: bufferMaxSize,
    errorSlotReserve,
  });

  const flushManagerOptions = createFlushManagerOptions();
  const flushManager = new FlushManager(buildLogService, logger, flushManagerOptions);

  flushManager.scheduleFlush(logBuffer, deploymentId, () => {
    const stats = logBuffer.getStats();
    if (stats.droppedCount > 0) {
      logger.warn("Deploy logs have been dropped due to buffer pressure", {
        deploymentId,
        droppedCount: stats.droppedCount,
        droppedErrorCount: stats.droppedErrorCount,
        droppedGeneralCount: stats.droppedGeneralCount,
        utilizationPercent: stats.utilizationPercent.toFixed(1),
      });
    }
  });

  const progressCallback: DeployProgressCallback = async (event) => {
    await emitProgress(
      context,
      deploymentId,
      logBuffer,
      lineNumberRef,
      "DEPLOY" as BuildLogSource,
      logger,
      {
        message: event.message,
        level: event.level,
        stage: event.stage,
        progress: event.progress,
      }
    );
  };

  // Extend lock TTL before long-running strategy execution
  try {
    await lock.extend(deploymentId, lockToken, LOCK_TTL_MS);
    await lock.extendProjectLock(projectId, projectLockToken, LOCK_TTL_MS);
  } catch (extendError) {
    logger.warn("Failed to extend deploy lock TTL", {
      deploymentId,
      error: extendError instanceof Error ? extendError.message : String(extendError),
    });
  }

  try {
    await orchestrator.deploy(deploymentId, image, {
      progressCallback,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await emitProgress(
      context,
      deploymentId,
      logBuffer,
      lineNumberRef,
      "DEPLOY" as BuildLogSource,
      logger,
      {
        message: `Deployment failed: ${errorMessage}`,
        level: "ERROR" as LogLevel,
        stage: "error",
      }
    );

    logger.error("Deployment failed", { deploymentId, error: errorMessage });

    await orchestrator.handleFailure(deploymentId, errorMessage);

    throw error;
  } finally {
    const finalResult = await flushManager.flush(logBuffer, deploymentId);
    flushManager.stop();

    const finalStats = logBuffer.getStats();
    logger.info("Deploy log buffer final statistics", {
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
  }
}

function createDeployLock(queueConfig: QueueConfig): RedisDeployLock {
  if (queueConfig.connection.type !== "redis" || !queueConfig.connection.redis) {
    throw new Error("Deploy lock requires Redis connection configuration");
  }

  return new RedisDeployLock(queueConfig.connection.redis);
}

async function cleanupLeftoverContainers(
  deploymentId: string,
  runtime: DockerRuntime
): Promise<void> {
  const db = getDatabaseClient();

  const leftovers = await db.container.findMany({
    where: {
      deploymentId,
      status: { in: ["CREATING", "STARTING", "RUNNING", "HEALTHY", "UNHEALTHY", "ERROR"] },
    },
    select: { containerId: true },
  });

  if (leftovers.length === 0) return;

  logger.info("Pre-flight cleanup: removing leftover containers from previous attempt", {
    deploymentId,
    containerCount: leftovers.length,
  });

  for (const container of leftovers) {
    try {
      await runtime.stop(container.containerId, { timeout: 10_000 });
    } catch {
      // Container may already be stopped
    }
    try {
      await runtime.remove(container.containerId, { force: true });
    } catch {
      // Container may already be removed
    }
  }

  await db.container.updateMany({
    where: {
      deploymentId,
      status: { in: ["CREATING", "STARTING", "RUNNING", "HEALTHY", "UNHEALTHY", "ERROR"] },
    },
    data: { status: "TERMINATED", healthStatus: "UNHEALTHY" },
  });

  logger.info("Pre-flight cleanup complete", {
    deploymentId,
    cleanedCount: leftovers.length,
  });
}
