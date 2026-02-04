import "dotenv/config";
import { createCacheService } from "./client";
import { CACHE_KEYS } from "./types";

const cacheConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD,
  db: 1,
};

async function testCache(): Promise<void> {
  try {
    console.log("Testing cache connection...");

    const cache = createCacheService(cacheConfig);

    console.log("\nTesting basic cache operations...");

    await cache.set("test-key", "test-value", 60);
    console.log("✓ Set cache value");

    const value = await cache.get("test-key");
    console.log("✓ Get cache value:", value);

    const exists = await cache.exists("test-key");
    console.log("✓ Key exists:", exists);

    const testObject = { id: "123", name: "Test Project" };
    await cache.set(CACHE_KEYS.PROJECT + "123", testObject, 300);
    console.log("✓ Set JSON object");

    const retrieved = await cache.get(CACHE_KEYS.PROJECT + "123");
    console.log("✓ Get JSON object:", retrieved);

    console.log("\nTesting hash operations...");

    await cache.hset("test-hash", "field1", "value1");
    await cache.hset("test-hash", "field2", { nested: "object" });
    console.log("✓ Set hash fields");

    const hashValue = await cache.hget("test-hash", "field1");
    console.log("✓ Get hash field:", hashValue);

    const allFields = await cache.hgetall("test-hash");
    console.log("✓ Get all hash fields:", allFields);

    console.log("\nTesting increment/decrement...");

    await cache.set("counter", "0");
    const incremented = await cache.increment("counter", 5);
    console.log("✓ Increment counter:", incremented);

    const decremented = await cache.decrement("counter", 2);
    console.log("✓ Decrement counter:", decremented);

    await cache.delete("test-key");
    await cache.delete(CACHE_KEYS.PROJECT + "123");
    await cache.delete("test-hash");
    await cache.delete("counter");
    console.log("✓ Cleaned up test data");

    console.log("\n✓ All cache tests passed!");
    process.exit(0);
  } catch (error) {
    console.error("✗ Cache test failed:", error);
    process.exit(1);
  }
}

testCache();
