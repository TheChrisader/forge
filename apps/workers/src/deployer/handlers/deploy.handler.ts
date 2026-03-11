import { getDatabaseClient } from "@forge/database";
import { DockerRuntime } from "@forge/docker";
import type { DeployJobData } from "@forge/types";
import type { IJobContext } from "@forge/queue";
import { LoggerService } from "@forge/logger";
import type { LogLevel } from "@forge/types";
import { BuildLogService } from "@forge/core";
import type { BuildLogSource } from "@forge/types";
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

export async function handleDeployJob(context: IJobContext<DeployJobData>): Promise<void> {
  const { deploymentId, projectId, image } = context.job.data;

  logger.info("Processing deploy job", { deploymentId, projectId, image });

  const db = getDatabaseClient();
  const buildLogService = new BuildLogService(db);
  const runtime = new DockerRuntime();
  const orchestrator = new DeploymentOrchestrator(db, runtime, logger);

  // Initialize line number ref from existing logs to continue sequence
  const lineNumberRef = await initializeLineNumberRef(buildLogService, deploymentId);

  logger.info("Deploy handler initialized", {
    deploymentId,
    lastLineNumber: lineNumberRef.value,
  });

  // Configure log buffer with size limits from environment
  const bufferMaxSize = parseBufferSize(process.env.DEPLOY_LOG_BUFFER_SIZE, 500);
  const errorSlotReserve = parseErrorSlotReserve(process.env.DEPLOY_LOG_ERROR_SLOT_RESERVE, 0.1);

  const logBuffer = new PriorityLogBuffer({
    maxSize: bufferMaxSize,
    errorSlotReserve,
  });

  // Configure flush manager with retry and circuit breaker
  const flushManagerOptions = createFlushManagerOptions();
  const flushManager = new FlushManager(buildLogService, logger, flushManagerOptions);

  // Schedule automatic flushing
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

  // Create progress callback for orchestrator
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

  try {
    await orchestrator.deploy(deploymentId, image, {
      progressCallback,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Emit error progress
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

    // Update deployment status to FAILED and cleanup
    await orchestrator.handleFailure(deploymentId, null, errorMessage);

    // Re-throw for BullMQ retry logic (will be marked failed after max retries)
    throw error;
  } finally {
    // Final flush before cleanup
    const finalResult = await flushManager.flush(logBuffer, deploymentId);
    flushManager.stop();

    // Log final buffer statistics
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
