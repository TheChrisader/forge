import { setTimeout } from "timers/promises";

/**
 * Wait for a condition to be true
 * Polls the condition at regular intervals until it returns true or timeout is reached
 *
 * @param condition - Function that returns true when the condition is met
 * @param options - Configuration options
 * @throws Error if timeout is reached before condition is met
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    message?: string;
  } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100, message = "Condition not met" } = options;

  const startTime = Date.now();

  while (true) {
    const result = await condition();

    if (result) {
      return;
    }

    if (Date.now() - startTime > timeout) {
      throw new Error(`Timeout: ${message}`);
    }

    await setTimeout(interval);
  }
}

/**
 * Wait for a specific amount of time
 * Use sparingly - prefer waitFor() for most cases
 */
export async function sleep(ms: number): Promise<void> {
  await setTimeout(ms);
}

/**
 * Retry a function until it succeeds or max attempts is reached
 *
 * @param fn - Async function to retry
 * @param options - Configuration options
 * @throws Last error if all attempts fail
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: boolean;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, backoff = false } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxAttempts) {
        const waitTime = backoff ? delay * attempt : delay;
        await setTimeout(waitTime);
      }
    }
  }

  if (lastError) {
    throw lastError;
  }
  throw new Error("Retry failed: no attempts made");
}

/**
 * Collect items from an async iterable into an array
 */
export async function collectAsync<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) {
    items.push(item);
  }
  return items;
}

/**
 * Create a promise that can be resolved externally
 * Useful for testing async workflows
 */
export function createDeferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolve: (value: T) => void;
  let reject: (error: Error) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve: resolve!, reject: reject! };
}

/**
 * Assert that an async function throws an error
 */
export async function assertThrows<T extends Error>(
  fn: () => Promise<unknown>,
  errorClass?: new (...args: unknown[]) => T
): Promise<T> {
  try {
    await fn();
    throw new Error("Expected function to throw, but it did not");
  } catch (error) {
    if (errorClass && !(error instanceof errorClass)) {
      throw new Error(
        `Expected error to be instance of ${errorClass.name}, but got ${(error as Error).constructor.name}`
      );
    }
    return error as T;
  }
}
