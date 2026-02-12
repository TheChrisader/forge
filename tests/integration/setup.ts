import { beforeAll, afterAll, beforeEach } from "vitest";
import { TestDatabase, TestRedis, resetFactories } from "@forge/test-utils";

/**
 * Global test database instance
 * Use testDb.getClient() to get the Prisma client
 */
export const testDb = new TestDatabase();

/**
 * Global test Redis instance
 * Use testRedis.getClient() to get the Redis client
 */
export const testRedis = new TestRedis();

let containersStarted = false;

beforeAll(async () => {
  console.log("Setting up test environment...");

  try {
    await Promise.all([testDb.start(), testRedis.start()]);
    containersStarted = true;
    console.log("Test environment ready");
  } catch (error) {
    console.error("Failed to start test environment:", error);
    throw error;
  }
}, 180000);

afterAll(async () => {
  console.log("Tearing down test environment...");

  try {
    await Promise.all([testDb.stop(), testRedis.stop()]);
    console.log("Test environment cleaned up");
  } catch (error) {
    console.error("Error during teardown:", error);
  }
}, 30000);

beforeEach(async () => {
  resetFactories();

  if (containersStarted) {
    await Promise.all([testDb.reset(), testRedis.reset()]);
  }
});

// afterEach(() => {
// });
