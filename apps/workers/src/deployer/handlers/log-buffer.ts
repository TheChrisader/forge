/**
 * Log Buffer - Memory-bounded buffering for deploy logs
 *
 * Provides unbounded log buffer protection through size limits and
 * configurable drop strategies. Prevents unbounded memory growth during
 * deployments by enforcing maximum buffer capacity.
 *
 * @module log-buffer
 */

import type { BuildLogEntry } from "@forge/core";

/**
 * Configuration options for the log buffer
 */
export interface LogBufferOptions {
  /**
   * Maximum number of log entries to buffer
   * When exceeded, entries are dropped based on dropStrategy
   */
  maxSize: number;

  /**
   * Strategy for handling buffer overflow
   * - "ring": Drop oldest entry when buffer is full (circular buffer)
   * - "reject": Drop new entry when buffer is full
   */
  dropStrategy: "ring" | "reject";
}

/**
 * Statistics about buffer utilization
 */
export interface LogBufferStats {
  /** Current number of entries in buffer */
  currentSize: number;

  /** Maximum configured buffer size */
  maxSize: number;

  /** Total number of entries dropped due to buffer overflow */
  droppedCount: number;

  /** Current buffer utilization as percentage (0-100+) */
  utilizationPercent: number;
}

/**
 * Statistics for priority buffer (includes error-specific stats)
 */
export interface PriorityLogBufferStats extends LogBufferStats {
  /** Number of ERROR level entries currently buffered */
  errorCount: number;

  /** Number of non-ERROR entries currently buffered */
  generalCount: number;

  /** Maximum number of ERROR entries allowed */
  errorLimit: number;

  /** Maximum number of non-ERROR entries allowed */
  generalLimit: number;

  /** Number of ERROR entries dropped */
  droppedErrorCount: number;

  /** Number of non-ERROR entries dropped */
  droppedGeneralCount: number;
}

/**
 * Configuration options for priority log buffer
 */
export interface PriorityLogBufferOptions {
  /**
   * Maximum total number of log entries to buffer
   */
  maxSize: number;

  /**
   * Percentage of buffer reserved for ERROR logs (0-1)
   * Default: 0.1 (10%)
   */
  errorSlotReserve: number;
}

/**
 * Basic log buffer with size limits and drop strategies
 *
 * Provides memory-safe buffering that prevents unbounded growth
 * by enforcing maximum capacity.
 *
 * @example
 * ```typescript
 * const buffer = new LogBuffer({ maxSize: 1000, dropStrategy: "ring" });
 *
 * // Add entries
 * buffer.push({ deploymentId, lineNumber: 1, timestamp: new Date(), level: "INFO", message: "test", source: "DEPLOY" });
 *
 * // Check utilization
 * const stats = buffer.getStats();
 * if (stats.utilizationPercent > 80) {
 *   logger.warn("Log buffer nearly full", stats);
 * }
 *
 * // Flush to database
 * const entries = buffer.flush();
 * await buildLogService.appendBatch(entries);
 * ```
 */
export class LogBuffer {
  protected buffer: BuildLogEntry[] = [];
  protected droppedCount = 0;

  constructor(protected readonly options: LogBufferOptions) {
    if (options.maxSize <= 0) {
      throw new Error(`LogBuffer maxSize must be positive, got: ${options.maxSize}`);
    }
  }

  /**
   * Attempt to add an entry to the buffer
   * @param entry - Log entry to add
   * @returns true if entry was added, false if dropped
   */
  push(entry: BuildLogEntry): boolean {
    if (this.buffer.length >= this.options.maxSize) {
      if (this.options.dropStrategy === "ring") {
        // Drop oldest entry to make room
        this.buffer.shift();
        this.droppedCount++;
      } else {
        // Reject strategy: drop new entry
        this.droppedCount++;
        return false;
      }
    }

    this.buffer.push(entry);
    return true;
  }

  /**
   * Remove all entries from buffer and return them
   * @returns Array of buffered entries (empty if buffer was empty)
   */
  flush(): BuildLogEntry[] {
    const entries = [...this.buffer];
    this.buffer.length = 0;
    return entries;
  }

  /**
   * Get current buffer statistics
   */
  getStats(): LogBufferStats {
    return {
      currentSize: this.buffer.length,
      maxSize: this.options.maxSize,
      droppedCount: this.droppedCount,
      utilizationPercent: (this.buffer.length / this.options.maxSize) * 100,
    };
  }

  /**
   * Get current number of entries in buffer
   */
  getLength(): number {
    return this.buffer.length;
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(): boolean {
    return this.buffer.length === 0;
  }

  /**
   * Get the maximum configured size
   */
  getMaxSize(): number {
    return this.options.maxSize;
  }

  /**
   * Get total dropped count
   */
  getDroppedCount(): number {
    return this.droppedCount;
  }
}

/**
 * Priority log buffer with reserved slots for ERROR logs
 *
 * Extends basic buffer with priority handling for ERROR logs.
 * A configured percentage of buffer space is reserved exclusively
 * for ERROR-level logs, ensuring critical error messages are
 * preserved even under high INFO/DEBUG volume.
 *
 * Behavior:
 * - ERROR logs ring-buffer when error slot is full (always preserve space)
 * - INFO/DEBUG logs are rejected when general buffer is full
 * - Error slot defaults to 10% of total buffer size
 *
 * @example
 * ```typescript
 * const buffer = new PriorityLogBuffer({
 *   maxSize: 1000,
 *   errorSlotReserve: 0.1, // 10% for errors = 100 slots
 * });
 *
 * // Always accepts ERROR logs (ring if error slot full)
 * buffer.push({ level: "ERROR", ... });
 *
 * // Rejects INFO logs when general buffer full
 * buffer.push({ level: "INFO", ... });
 *
 * const stats = buffer.getStats();
 * console.log(`Errors: ${stats.errorCount}/${stats.errorLimit}`);
 * console.log(`General: ${stats.generalCount}/${stats.generalLimit}`);
 * ```
 */
export class PriorityLogBuffer {
  private errorBuffer: BuildLogEntry[] = [];
  private generalBuffer: BuildLogEntry[] = [];
  private droppedErrorCount = 0;
  private droppedGeneralCount = 0;

  constructor(private readonly options: PriorityLogBufferOptions) {
    if (options.maxSize <= 0) {
      throw new Error(`PriorityLogBuffer maxSize must be positive, got: ${options.maxSize}`);
    }
    if (options.errorSlotReserve < 0 || options.errorSlotReserve > 1) {
      throw new Error(
        `PriorityLogBuffer errorSlotReserve must be between 0 and 1, got: ${options.errorSlotReserve}`
      );
    }
  }

  /**
   * Maximum number of ERROR entries allowed
   */
  get errorLimit(): number {
    return Math.ceil(this.options.maxSize * this.options.errorSlotReserve);
  }

  /**
   * Maximum number of non-ERROR entries allowed
   */
  get generalLimit(): number {
    return this.options.maxSize - this.errorLimit;
  }

  /**
   * Attempt to add an entry to the buffer
   * @param entry - Log entry to add
   * @returns true if entry was added, false if dropped
   */
  push(entry: BuildLogEntry): boolean {
    const isError = entry.level === "ERROR";

    if (isError) {
      return this.pushError(entry);
    } else {
      return this.pushGeneral(entry);
    }
  }

  private pushError(entry: BuildLogEntry): boolean {
    if (this.errorBuffer.length >= this.errorLimit) {
      // Error buffer full - ring buffer to preserve most recent errors
      this.errorBuffer.shift();
      this.droppedErrorCount++;
    }
    this.errorBuffer.push(entry);
    return true;
  }

  private pushGeneral(entry: BuildLogEntry): boolean {
    if (this.generalBuffer.length >= this.generalLimit) {
      // General buffer full - reject new entry
      this.droppedGeneralCount++;
      return false;
    }
    this.generalBuffer.push(entry);
    return true;
  }

  /**
   * Remove all entries from buffer and return them
   * @returns Array of buffered entries (errors first, then general logs)
   */
  flush(): BuildLogEntry[] {
    // Return errors first, then general logs (preserves chronological order within each)
    const entries = [...this.errorBuffer, ...this.generalBuffer];
    this.errorBuffer.length = 0;
    this.generalBuffer.length = 0;
    return entries;
  }

  /**
   * Get current buffer statistics
   */
  getStats(): PriorityLogBufferStats {
    const totalSize = this.errorBuffer.length + this.generalBuffer.length;
    return {
      currentSize: totalSize,
      maxSize: this.options.maxSize,
      droppedCount: this.droppedErrorCount + this.droppedGeneralCount,
      utilizationPercent: (totalSize / this.options.maxSize) * 100,
      errorCount: this.errorBuffer.length,
      generalCount: this.generalBuffer.length,
      errorLimit: this.errorLimit,
      generalLimit: this.generalLimit,
      droppedErrorCount: this.droppedErrorCount,
      droppedGeneralCount: this.droppedGeneralCount,
    };
  }

  /**
   * Get current number of entries in buffer
   */
  getLength(): number {
    return this.errorBuffer.length + this.generalBuffer.length;
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(): boolean {
    return this.errorBuffer.length === 0 && this.generalBuffer.length === 0;
  }

  /**
   * Get the maximum configured size
   */
  getMaxSize(): number {
    return this.options.maxSize;
  }

  /**
   * Get total dropped count
   */
  getDroppedCount(): number {
    return this.droppedErrorCount + this.droppedGeneralCount;
  }

  /**
   * Get dropped count for ERROR logs only
   */
  getDroppedErrorCount(): number {
    return this.droppedErrorCount;
  }

  /**
   * Get dropped count for non-ERROR logs only
   */
  getDroppedGeneralCount(): number {
    return this.droppedGeneralCount;
  }
}

/**
 * Parse environment variable for buffer size
 * @param envVar - Environment variable name
 * @param defaultValue - Default value if not set or invalid
 * @returns Parsed number value
 */
export function parseBufferSize(envVar: string | undefined, defaultValue: number): number {
  if (!envVar) {
    return defaultValue;
  }
  const parsed = Number.parseInt(envVar, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return defaultValue;
  }
  return parsed;
}

/**
 * Parse environment variable for drop strategy
 * @param envVar - Environment variable name
 * @param defaultValue - Default value if not set or invalid
 * @returns Parsed drop strategy
 */
export function parseDropStrategy(
  envVar: string | undefined,
  defaultValue: "ring" | "reject"
): "ring" | "reject" {
  if (!envVar) {
    return defaultValue;
  }
  if (envVar === "ring" || envVar === "reject") {
    return envVar;
  }
  return defaultValue;
}

/**
 * Parse environment variable for error slot reserve percentage
 * @param envVar - Environment variable name
 * @param defaultValue - Default value if not set or invalid
 * @returns Parsed percentage (0-1)
 */
export function parseErrorSlotReserve(envVar: string | undefined, defaultValue: number): number {
  if (!envVar) {
    return defaultValue;
  }
  const parsed = Number.parseFloat(envVar);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) {
    return defaultValue;
  }
  return parsed;
}
