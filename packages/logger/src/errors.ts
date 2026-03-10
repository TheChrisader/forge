/**
 * Logger package errors
 */

/**
 * Base error for logger-related issues
 */
export class LoggerError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "LoggerError";
    Object.setPrototypeOf(this, LoggerError.prototype);
  }
}

/**
 * Error thrown when logger configuration is invalid
 */
export class LoggerConfigError extends LoggerError {
  constructor(
    message: string,
    public readonly validationErrors?: string[]
  ) {
    super(message);
    this.name = "LoggerConfigError";
    this.validationErrors = validationErrors;
    Object.setPrototypeOf(this, LoggerConfigError.prototype);
  }
}

/**
 * Error thrown when a logger operation fails
 */
export class LoggerOperationError extends LoggerError {
  constructor(
    message: string,
    public readonly operation: string,
    cause?: unknown
  ) {
    super(message, cause);
    this.name = "LoggerOperationError";
    Object.setPrototypeOf(this, LoggerOperationError.prototype);
  }
}
