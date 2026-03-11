/**
 * Logger Service
 *
 * Production-grade logger implementation using Pino.
 * Implements the ILogger interface from @forge/core.
 */

import pino from "pino";
import type { ILogger, LogContext } from "@forge/core";
import type { LogLevel } from "@forge/types";
import type { LoggerConfig } from "./types";
import { LoggerConfigError, LoggerOperationError } from "./errors";

/**
 * Validate logger configuration
 * @throws {LoggerConfigError} if configuration is invalid
 */
function validateConfig(config: LoggerConfig): void {
  const errors: string[] = [];

  if (!config.level) {
    errors.push("level is required");
  } else if (!["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"].includes(config.level)) {
    errors.push(
      `level must be one of: trace, debug, info, warn, error, fatal. Got: ${config.level}`
    );
  }

  if (!config.format) {
    errors.push("format is required");
  } else if (!["json", "pretty"].includes(config.format)) {
    errors.push(`format must be one of: json, pretty. Got: ${config.format}`);
  }

  if (typeof config.enabled !== "boolean") {
    errors.push(`enabled must be a boolean. Got: ${typeof config.enabled}`);
  }

  if (errors.length > 0) {
    throw new LoggerConfigError("Invalid logger configuration", errors);
  }
}

/**
 * Create Pino options from logger config
 */
function createPinoOptions(config: LoggerConfig): pino.LoggerOptions {
  const options: pino.LoggerOptions = {
    level: config.level,
    timestamp: config.timestamp !== false ? pino.stdTimeFunctions.isoTime : false,
    messageKey: config.messageKey ?? "msg",
    errorKey: config.errorKey ?? "err",
    formatters: {
      level: (label: string) => {
        return { level: label };
      },
    },
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },
  };

  if (config.redact && config.redact.length > 0) {
    options.redact = config.redact;
  }

  if (config.format === "pretty") {
    options.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss.l",
        ignore: "pid,hostname",
        singleLine: false,
      },
    };
  }

  return options;
}

/**
 * Logger Service Implementation
 *
 * Provides production-grade logging with:
 * - Multiple log levels (trace, debug, info, warn, error, fatal)
 * - Child logger support with context propagation
 * - Dynamic level management
 * - Optional flush for graceful shutdown
 */
export class LoggerService implements ILogger {
  private readonly pino: pino.Logger;
  private readonly config: LoggerConfig;
  private readonly boundContext: LogContext;

  /**
   * Create a new LoggerService instance
   * @param config - Logger configuration
   * @param context - Optional bound context (used for child loggers)
   * @param pinoInstance - Optional Pino instance (used for child loggers)
   * @throws {LoggerConfigError} if configuration is invalid
   */
  constructor(config: LoggerConfig, context: LogContext = {}, pinoInstance?: pino.Logger) {
    // Validate configuration
    validateConfig(config);
    this.config = config;
    this.boundContext = context;

    // Create or use provided Pino instance
    if (pinoInstance) {
      this.pino = pinoInstance;
    } else {
      const options = createPinoOptions(config);
      this.pino = pino(options);
    }

    // Set name if provided
    if (config.name) {
      this.boundContext.name = config.name;
    }
  }

  /**
   * Log at trace level
   */
  trace(msg: string, context?: LogContext): void {
    if (!this.config.enabled) return;
    this.pino.trace({ ...this.boundContext, ...context }, msg);
  }

  /**
   * Log at debug level
   */
  debug(msg: string, context?: LogContext): void {
    if (!this.config.enabled) return;
    this.pino.debug({ ...this.boundContext, ...context }, msg);
  }

  /**
   * Log at info level
   */
  info(msg: string, context?: LogContext): void {
    if (!this.config.enabled) return;
    this.pino.info({ ...this.boundContext, ...context }, msg);
  }

  /**
   * Log at warn level
   */
  warn(msg: string, context?: LogContext): void {
    if (!this.config.enabled) return;
    this.pino.warn({ ...this.boundContext, ...context }, msg);
  }

  /**
   * Log at error level
   */
  error(msg: string, context?: LogContext): void {
    if (!this.config.enabled) return;
    this.pino.error({ ...this.boundContext, ...context }, msg);
  }

  /**
   * Log at fatal level
   */
  fatal(msg: string, context?: LogContext): void {
    if (!this.config.enabled) return;
    this.pino.fatal({ ...this.boundContext, ...context }, msg);
  }

  /**
   * Create a child logger with bound context
   */
  child(context: LogContext): ILogger {
    if (!context || Object.keys(context).length === 0) {
      return this;
    }

    const mergedContext = { ...this.boundContext, ...context };
    const childPino = this.pino.child(context);

    return new LoggerService(this.config, mergedContext, childPino);
  }

  /**
   * Get the current log level
   */
  getLevel(): LogLevel {
    return this.pino.level as LogLevel;
  }

  /**
   * Set the log level dynamically
   */
  setLevel(level: LogLevel): void {
    if (!["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"].includes(level)) {
      throw new LoggerConfigError(
        `Invalid log level: ${level}. Must be one of: trace, debug, info, warn, error, fatal`
      );
    }

    this.pino.level = level;
  }

  /**
   * Flush any buffered log entries
   */
  async flush(): Promise<void> {
    return new Promise<void>((resolve) => {
      try {
        // Pino automatically flushes on sync for most transports
        // For transport-based logging (pino-pretty), we attempt to access the stream
        const pinoAny = this.pino as unknown as { [key: string]: unknown };

        // Try to access the stream symbol
        const symbols = (pino as unknown as { symbols?: { streamSym?: string } }).symbols;
        if (symbols?.streamSym) {
          const stream = pinoAny[symbols.streamSym];
          if (
            stream &&
            typeof (stream as { flush?: (callback: () => void) => void }).flush === "function"
          ) {
            (stream as { flush: (callback: () => void) => void }).flush(() => resolve());
            return;
          }
        }

        // No flush method available, resolve immediately
        resolve();
      } catch (error) {
        throw new LoggerOperationError("Failed to flush logger", "flush", error);
      }
    });
  }

  /**
   * Get the underlying Pino logger instance
   * This is useful for integrations with Pino-based systems
   */
  getPinoLogger(): pino.Logger {
    return this.pino;
  }
}

/**
 * Create a logger instance with the given configuration
 * @param config - Logger configuration
 * @returns LoggerService instance
 */
export function createLogger(config: LoggerConfig): LoggerService {
  return new LoggerService(config);
}

/**
 * Validate logger configuration without throwing
 * @param config - Logger configuration to validate
 * @returns Object with valid flag and optional errors
 */
export function validateLoggerConfig(config: LoggerConfig): { valid: boolean; errors?: string[] } {
  try {
    validateConfig(config);
    return { valid: true };
  } catch (error) {
    if (error instanceof LoggerConfigError) {
      return { valid: false, errors: error.validationErrors };
    }
    return { valid: false, errors: ["Unknown validation error"] };
  }
}
