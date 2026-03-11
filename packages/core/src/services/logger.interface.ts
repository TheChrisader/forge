/**
 * Logger Interface
 *
 * Defines the contract for logging services across the Forge platform.
 * All loggers must implement this interface to ensure consistent logging behavior.
 */

import type { LogLevel } from "@forge/types";

/**
 * Log entry context data
 * Can include any additional metadata relevant to the log entry
 */
export interface LogContext {
  [key: string]: unknown;
}

/**
 * Logger interface providing logging capabilities across the platform
 */
export interface ILogger {
  /**
   * Log at trace level (most verbose)
   * @param msg - Log message
   * @param context - Optional contextual data
   */
  trace(msg: string, context?: LogContext): void;

  /**
   * Log at debug level
   * @param msg - Log message
   * @param context - Optional contextual data
   */
  debug(msg: string, context?: LogContext): void;

  /**
   * Log at info level
   * @param msg - Log message
   * @param context - Optional contextual data
   */
  info(msg: string, context?: LogContext): void;

  /**
   * Log at warn level
   * @param msg - Log message
   * @param context - Optional contextual data
   */
  warn(msg: string, context?: LogContext): void;

  /**
   * Log at error level
   * @param msg - Log message
   * @param context - Optional contextual data (may include Error objects)
   */
  error(msg: string, context?: LogContext): void;

  /**
   * Log at fatal level (most severe)
   * @param msg - Log message
   * @param context - Optional contextual data
   */
  fatal(msg: string, context?: LogContext): void;

  /**
   * Create a child logger with bound context
   * The child logger inherits the parent's configuration and level
   * @param context - Context data to bind to all child log entries
   * @returns New ILogger instance with merged context
   */
  child(context: LogContext): ILogger;

  /**
   * Get the current log level
   * @returns Current log level
   */
  getLevel(): LogLevel;

  /**
   * Set the log level dynamically
   * @param level - New log level to apply
   */
  setLevel(level: LogLevel): void;

  /**
   * Flush any buffered log entries
   * Called during shutdown to ensure all logs are written
   * @returns Promise that resolves when logs are flushed
   */
  flush?(): Promise<void>;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /**
   * Minimum log level to output
   */
  level: LogLevel;

  /**
   * Log output format
   */
  format: "json" | "pretty";

  /**
   * Whether logging is enabled
   */
  enabled: boolean;

  /**
   * Optional logger name for identification
   */
  name?: string;

  /**
   * Optional redaction keys for sensitive data
   */
  redact?: string[];
}
