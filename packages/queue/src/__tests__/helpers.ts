/**
 * Test helpers for queue package tests
 */

import type { JobInfo } from "@forge/types";
import type { QueueConfig } from "../domain/types";

/**
 * Creates a test queue config for in-memory adapters
 */
export function createTestMemoryConfig(): QueueConfig {
  return {
    connection: { type: "memory" },
  };
}

/**
 * Creates a test queue config for Redis adapters
 */
export function createTestRedisConfig(port?: number): QueueConfig {
  return {
    connection: {
      type: "redis",
      redis: {
        host: "localhost",
        port: port || 6379,
        db: 1, // Use db 1 for tests to avoid conflicts
      },
    },
  };
}

/**
 * Creates a mock job info for testing
 */
export function createMockJobInfo<T>(overrides: Partial<JobInfo<T>> = {}): JobInfo<T> {
  return {
    id: "test-job-1",
    name: "test-job",
    data: {} as T,
    opts: {},
    progress: 0,
    attemptsMade: 0,
    timestamp: Date.now(),
    ...overrides,
  };
}

/**
 * Delay helper for tests
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Waits for a condition to be true
 */
export async function waitFor(condition: () => boolean, timeout: number = 5000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error(`Timeout waiting for condition after ${timeout}ms`);
    }
    await delay(10);
  }
}
