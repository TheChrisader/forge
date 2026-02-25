import { ForgeError } from "@forge/core";

export class OperationTimeoutError extends ForgeError {
  constructor(operation: string, timeoutMs: number) {
    super(
      "OPERATION_TIMEOUT",
      408, // Request Timeout
      `${operation} timed out after ${timeoutMs}ms`,
      { operation, timeoutMs }
    );
    this.name = "OperationTimeoutError";
  }
}
