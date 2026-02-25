import { OperationTimeoutError } from "./error.js";

export { OperationTimeoutError } from "./error.js";

/**
 * Wraps a promise with a timeout. Throws OperationTimeoutError if timeout expires.
 *
 * @example
 * ```ts
 * await withTimeout(
 *   gitService.clone({ ... }),
 *   5 * 60 * 1000,
 *   "Git clone"
 * );
 * ```
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new OperationTimeoutError(operation, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

export const TIMEOUTS = {
  GIT_CLONE: 5 * 60 * 1000, // 5 minutes
  DOCKER_BUILD: 30 * 60 * 1000, // 30 minutes
  DOCKER_PULL: 10 * 60 * 1000, // 10 minutes
  FRAMEWORK_DETECT: 30 * 1000, // 30 seconds
} as const;
