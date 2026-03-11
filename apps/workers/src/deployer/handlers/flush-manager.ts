/**
 * Flush Manager - Retry logic and circuit breaker for log flushing
 *
 * Handles database write failures with exponential backoff, jitter,
 * and circuit breaker pattern to prevent overwhelming a failing database.
 *
 * @module flush-manager
 */

import type { BuildLogService } from "@forge/core";
import type { ILogger } from "@forge/logger";
import type { PriorityLogBuffer } from "./log-buffer";

/**
 * Configuration options for the flush manager
 */
export interface FlushManagerOptions {
  /**
   * Whether retry logic is enabled
   * Default: false (backwards compatible with existing behavior)
   */
  enabled: boolean;

  /**
   * Maximum number of consecutive failures before opening circuit breaker
   * Default: 5
   */
  maxRetryAttempts: number;

  /**
   * Base flush interval in milliseconds
   * Default: 2000 (2 seconds)
   */
  baseInterval: number;

  /**
   * Maximum backoff interval in milliseconds
   * Default: 16000 (16 seconds)
   */
  maxInterval: number;

  /**
   * Jitter amount in milliseconds (±jitter)
   * Default: 500 (±500ms)
   */
  jitterMs: number;

  /**
   * Circuit breaker recovery attempt interval in milliseconds
   * Default: 60000 (60 seconds)
   */
  recoveryIntervalMs: number;
}

/**
 * Result of a flush operation
 */
export interface FlushResult {
  /** Whether the flush was successful */
  success: boolean;

  /** Number of entries flushed */
  entryCount: number;

  /** Whether circuit breaker is open */
  circuitBreakerOpen: boolean;

  /** Current consecutive failure count */
  consecutiveFailures: number;
}

/**
 * Manages log flushing with retry logic and circuit breaker
 *
 * Provides robust database write handling through:
 * - Exponential backoff with jitter on failures
 * - Circuit breaker to prevent overwhelming failing databases
 * - Automatic recovery attempts after circuit breaker opens
 *
 * @example
 * ```typescript
 * const manager = new FlushManager(buildLogService, logger, {
 *   enabled: true,
 *   maxRetryAttempts: 5,
 *   baseInterval: 2000,
 *   maxInterval: 16000,
 *   jitterMs: 500,
 * });
 *
 * // Schedule automatic flushing
 * manager.scheduleFlush(buffer, deploymentId, () => {
 *   logger.debug("Flush completed");
 * });
 *
 * // Or manually flush
 * const result = await manager.flush(buffer, deploymentId);
 * if (!result.success) {
 *   logger.error("Flush failed", { consecutiveFailures: result.consecutiveFailures });
 * }
 *
 * // Stop scheduled flushing
 * manager.stop();
 * ```
 */
export class FlushManager {
  private consecutiveFailures = 0;
  private currentFlushTimeout: ReturnType<typeof setTimeout> | null = null;
  private circuitBreakerOpen = false;
  private recoveryTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly buildLogService: BuildLogService,
    private readonly logger: ILogger,
    private readonly options: FlushManagerOptions
  ) {
    if (options.baseInterval <= 0) {
      throw new Error(`FlushManager baseInterval must be positive, got: ${options.baseInterval}`);
    }
    if (options.maxInterval < options.baseInterval) {
      throw new Error(
        `FlushManager maxInterval (${options.maxInterval}) must be >= baseInterval (${options.baseInterval})`
      );
    }
    if (options.maxRetryAttempts < 0) {
      throw new Error(
        `FlushManager maxRetryAttempts must be non-negative, got: ${options.maxRetryAttempts}`
      );
    }
  }

  /**
   * Attempt to flush buffer contents to database
   * @param buffer - Log buffer to flush
   * @param deploymentId - Deployment ID for logging
   * @returns Flush result with success status and metadata
   */
  async flush(buffer: PriorityLogBuffer, deploymentId: string): Promise<FlushResult> {
    if (buffer.isEmpty()) {
      return {
        success: true,
        entryCount: 0,
        circuitBreakerOpen: this.circuitBreakerOpen,
        consecutiveFailures: this.consecutiveFailures,
      };
    }

    if (this.circuitBreakerOpen) {
      this.logger.warn("Circuit breaker open - skipping flush", { deploymentId });
      return {
        success: false,
        entryCount: 0,
        circuitBreakerOpen: true,
        consecutiveFailures: this.consecutiveFailures,
      };
    }

    const entries = buffer.flush();
    const entryCount = entries.length;

    try {
      await this.buildLogService.appendBatch(entries);
      this.consecutiveFailures = 0;
      this.logger.debug("Successfully flushed logs to database", {
        deploymentId,
        entryCount,
      });
      return {
        success: true,
        entryCount,
        circuitBreakerOpen: false,
        consecutiveFailures: 0,
      };
    } catch (error) {
      this.consecutiveFailures++;
      this.logger.error("Failed to flush logs to database", {
        error,
        deploymentId,
        entryCount,
        attempt: this.consecutiveFailures,
        maxAttempts: this.options.maxRetryAttempts,
      });

      // Check if we should open circuit breaker
      if (this.options.enabled && this.consecutiveFailures >= this.options.maxRetryAttempts) {
        this.openCircuitBreaker(deploymentId);
      }

      // Entries were already flushed from buffer - they're lost
      // In production, consider keeping them in buffer until success
      // or implementing a disk spillover mechanism

      return {
        success: false,
        entryCount,
        circuitBreakerOpen: this.circuitBreakerOpen,
        consecutiveFailures: this.consecutiveFailures,
      };
    }
  }

  /**
   * Open circuit breaker and schedule recovery attempt
   * @param deploymentId - Deployment ID for logging
   */
  private openCircuitBreaker(deploymentId: string): void {
    this.circuitBreakerOpen = true;
    this.logger.error("Circuit breaker opened - database appears unavailable", {
      deploymentId,
      consecutiveFailures: this.consecutiveFailures,
      maxRetryAttempts: this.options.maxRetryAttempts,
    });

    // Schedule recovery attempt
    this.scheduleRecovery(deploymentId);
  }

  /**
   * Schedule circuit breaker recovery attempt
   * @param deploymentId - Deployment ID for logging
   */
  private scheduleRecovery(deploymentId: string): void {
    if (this.recoveryTimeout) {
      clearTimeout(this.recoveryTimeout);
    }

    this.recoveryTimeout = setTimeout(() => {
      void this.attemptRecovery(deploymentId);
    }, this.options.recoveryIntervalMs);
  }

  /**
   * Attempt to recover from circuit breaker state
   * @param deploymentId - Deployment ID for logging
   */
  private async attemptRecovery(deploymentId: string): Promise<void> {
    this.logger.info("Attempting circuit breaker recovery", { deploymentId });

    try {
      // Test database connectivity with a simple query
      await this.buildLogService.getLineCount(deploymentId);
      this.circuitBreakerOpen = false;
      this.consecutiveFailures = 0;
      this.recoveryTimeout = null;
      this.logger.info("Circuit breaker recovered - database is available", { deploymentId });
    } catch (error) {
      this.logger.warn("Circuit breaker recovery failed - will retry later", {
        deploymentId,
        error,
      });
      // Schedule another recovery attempt
      this.scheduleRecovery(deploymentId);
    }
  }

  /**
   * Calculate the next flush interval based on consecutive failures
   * @returns Interval in milliseconds
   */
  private calculateInterval(): number {
    if (!this.options.enabled || this.consecutiveFailures === 0) {
      return this.options.baseInterval;
    }

    // Exponential backoff: 2^failures * baseInterval
    const backoff = Math.min(
      this.options.baseInterval * Math.pow(2, this.consecutiveFailures),
      this.options.maxInterval
    );

    // Add jitter: ±jitterMs
    const jitter = Math.random() * 2 * this.options.jitterMs - this.options.jitterMs;

    return Math.max(backoff + jitter, this.options.baseInterval);
  }

  /**
   * Schedule automatic periodic flushing
   * @param buffer - Log buffer to flush
   * @param deploymentId - Deployment ID for logging
   * @param callback - Optional callback after each flush attempt
   */
  scheduleFlush(buffer: PriorityLogBuffer, deploymentId: string, callback?: () => void): void {
    // Clear any existing flush timeout
    this.stop();

    const flushAndSchedule = async (): Promise<void> => {
      const result = await this.flush(buffer, deploymentId);

      // Call callback if provided
      callback?.();

      // Schedule next flush
      const nextInterval = this.calculateInterval();
      this.currentFlushTimeout = setTimeout(flushAndSchedule, nextInterval);

      this.logger.debug("Scheduled next flush", {
        deploymentId,
        intervalMs: nextInterval,
        consecutiveFailures: result.consecutiveFailures,
        circuitBreakerOpen: result.circuitBreakerOpen,
      });
    };

    // Start first flush
    const initialInterval = this.calculateInterval();
    this.currentFlushTimeout = setTimeout(flushAndSchedule, initialInterval);

    this.logger.debug("Scheduled flush manager", {
      deploymentId,
      intervalMs: initialInterval,
      enabled: this.options.enabled,
    });
  }

  /**
   * Stop scheduled flushing
   */
  stop(): void {
    if (this.currentFlushTimeout) {
      clearTimeout(this.currentFlushTimeout);
      this.currentFlushTimeout = null;
    }

    if (this.recoveryTimeout) {
      clearTimeout(this.recoveryTimeout);
      this.recoveryTimeout = null;
    }
  }

  /**
   * Get current consecutive failure count
   */
  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  /**
   * Check if circuit breaker is currently open
   */
  isCircuitBreakerOpen(): boolean {
    return this.circuitBreakerOpen;
  }

  /**
   * Get current options (for testing/monitoring)
   */
  getOptions(): Readonly<FlushManagerOptions> {
    return { ...this.options };
  }
}

/**
 * Parse environment variable for boolean flag
 * @param envVar - Environment variable value
 * @param defaultValue - Default value if not set
 * @returns Parsed boolean value
 */
export function parseBooleanFlag(envVar: string | undefined, defaultValue: boolean): boolean {
  if (!envVar) {
    return defaultValue;
  }
  return envVar.toLowerCase() === "true";
}

/**
 * Parse environment variable for numeric value
 * @param envVar - Environment variable value
 * @param defaultValue - Default value if not set or invalid
 * @returns Parsed number value
 */
export function parseNumberValue(envVar: string | undefined, defaultValue: number): number {
  if (!envVar) {
    return defaultValue;
  }
  const parsed = Number.parseInt(envVar, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return defaultValue;
  }
  return parsed;
}

/**
 * Create FlushManager options from environment variables
 * @returns FlushManager options with defaults applied
 */
export function createFlushManagerOptions(): Required<
  Omit<FlushManagerOptions, "recoveryIntervalMs">
> & { recoveryIntervalMs: number } {
  return {
    enabled: parseBooleanFlag(process.env.BUILD_LOG_FLUSH_RETRY, false),
    maxRetryAttempts: parseNumberValue(process.env.BUILD_LOG_MAX_RETRY_ATTEMPTS, 5),
    baseInterval: parseNumberValue(process.env.BUILD_LOG_BASE_INTERVAL, 2000),
    maxInterval: parseNumberValue(process.env.BUILD_LOG_MAX_INTERVAL, 16000),
    jitterMs: parseNumberValue(process.env.BUILD_LOG_JITTER_MS, 500),
    recoveryIntervalMs: parseNumberValue(process.env.BUILD_LOG_RECOVERY_INTERVAL_MS, 60000),
  };
}
