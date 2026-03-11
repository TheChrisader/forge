/**
 * Shared progress emission utilities for worker jobs
 *
 * Provides unified progress emission that works across
 * different job handlers (build, deploy, etc.) with proper
 * lineNumber sequencing.
 */

import type { BuildLogEntry } from "@forge/core";
import type { BuildLogSource } from "@forge/types";
import type { IJobContext } from "@forge/queue";
import type { LogLevel } from "@forge/types";
import type { ILogger } from "@forge/logger";

/**
 * Options for emitting progress events
 */
export interface EmitProgressOptions {
  message: string;
  level?: LogLevel;
  stage?: string;
  progress?: number;
  log?: boolean;
}

/**
 * Shared emitProgress function that can be used across all job handlers
 *
 * This function:
 * 1. Emits to BullMQ for real-time SSE streaming
 * 2. Logs to console for debugging
 * 3. Buffers for database persistence
 *
 * @param context - BullMQ job context
 * @param deploymentId - Deployment ID for the logs
 * @param logBuffer - Priority log buffer for database batching
 * @param lineNumberRef - Reference to line number counter (persisted across stages)
 * @param source - Log source identifier ("BUILD", "DEPLOY", etc.)
 * @param logger - Logger instance for console output
 * @param options - Progress event options
 */
export async function emitProgress<T = unknown>(
  context: IJobContext<T>,
  deploymentId: string,
  logBuffer: {
    push(entry: BuildLogEntry): boolean;
    getStats?(): { utilizationPercent: number; droppedCount: number };
  },
  lineNumberRef: { value: number },
  source: BuildLogSource,
  logger: ILogger,
  options: EmitProgressOptions
): Promise<void> {
  const lineNum = lineNumberRef.value++;
  const logLevel = (options.level ?? "INFO") as LogLevel;
  const shouldLog = options?.log ?? true;

  // Emit to BullMQ for real-time streaming
  await context.updateProgress({
    type: "deployment.log",
    deploymentId,
    data: {
      lineNumber: lineNum,
      timestamp: new Date().toISOString(),
      level: logLevel,
      source,
      message: options.message,
      stage: options.stage,
      progress: options.progress,
    },
  });

  // Console logging
  if (shouldLog) {
    logger.info(options.message, {
      deploymentId,
      type: options.stage ?? "log",
      stage: options.stage,
      progress: options.progress,
      level: logLevel,
      source,
    });
  }

  // Buffer with backpressure - may drop logs under high volume
  const accepted = logBuffer.push({
    deploymentId,
    lineNumber: lineNum,
    timestamp: new Date(),
    level: logLevel,
    message: options.message,
    source,
  });

  if (!accepted && logBuffer.getStats) {
    // Log dropped - buffer full
    const stats = logBuffer.getStats();
    logger.warn("Log dropped due to buffer full", {
      deploymentId,
      level: logLevel,
      message: options.message,
      bufferUtilization: stats.utilizationPercent.toFixed(1),
      droppedCount: stats.droppedCount,
    });
  }
}

/**
 * Initialize line number ref from existing logs in the database
 *
 * This ensures that deploy logs continue from where build logs left off,
 * preventing deduplication conflicts in the SSE client.
 *
 * @param buildLogService - BuildLogService instance
 * @param deploymentId - Deployment ID
 * @returns Line number ref initialized to the current log count
 */
export async function initializeLineNumberRef(
  buildLogService: { getLineCount(deploymentId: string): Promise<number> },
  deploymentId: string
): Promise<{ value: number }> {
  const lastLineNumber = await buildLogService.getLineCount(deploymentId);
  return { value: lastLineNumber };
}
