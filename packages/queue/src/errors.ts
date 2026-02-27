/**
 * Domain-specific errors for the queue package
 */

export class QueueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueueError";
  }
}

/**
 * Queue connection error
 */
export class QueueConnectionError extends QueueError {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "QueueConnectionError";
  }
}

/**
 * Queue job error
 */
export class QueueJobError extends QueueError {
  constructor(
    message: string,
    public readonly jobId?: string
  ) {
    super(message);
    this.name = "QueueJobError";
  }
}
