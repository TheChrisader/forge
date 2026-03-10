/**
 * Logger package types
 */

import type { LoggerConfig as CoreLoggerConfig } from "@forge/core";

/**
 * Re-export core logger configuration
 */
export type { LogLevel } from "@forge/core";
export type { LogContext, ILogger, LoggerConfig as CoreLoggerConfig } from "@forge/core";

/**
 * Logger configuration for the logger package
 * Extends the core configuration with package-specific options
 */
export interface LoggerConfig extends CoreLoggerConfig {
  /**
   * Optional output destination (defaults to stdout)
   */
  destination?: NodeJS.WritableStream;

  /**
   * Optional error output destination (defaults to stderr)
   */
  errorDestination?: NodeJS.WritableStream;

  /**
   * Whether to include timestamp in logs
   */
  timestamp?: boolean;

  /**
   * Custom error key name in log output
   */
  errorKey?: string;

  /**
   * Custom message key name in log output
   */
  messageKey?: string;

  /**
   * Custom level key name in log output
   */
  levelKey?: string;
}

/**
 * Pino logger options (internal use)
 */
export interface PinoLoggerOptions {
  level: string;
  formatters?: {
    level?: (label: string, number: number) => { level: string; [key: string]: unknown };
  };
  serializers?: {
    err?: () => unknown;
    error?: () => unknown;
  };
  timestamp?: boolean | (() => string);
  messageKey?: string;
  errorKey?: string;
  levelKey?: string;
  redact?: string[];
  transport?: {
    target: string;
    options?: {
      colorize?: boolean;
      translateTime?: string;
      ignore?: string;
      singleLine?: boolean;
    };
  };
}
