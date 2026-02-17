import Redis from "ioredis";

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  maxRetriesPerRequest?: number;
  enableReadyCheck?: boolean;
  retryStrategy?: (times: number) => number;
}

let cacheClient: Redis | undefined;

/**
 * Get or create a Redis connection for cache operations.
 * Uses db 1 by default (separate from queue's db 0).
 *
 * @param config - Cache connection configuration
 * @returns Redis connection instance
 */
export function getCacheClient(config: CacheConfig): Redis {
  if (!cacheClient) {
    cacheClient = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db || 1,
      keyPrefix: config.keyPrefix || "forge:cache:",
      maxRetriesPerRequest: config.maxRetriesPerRequest || 10,
      enableReadyCheck: config.enableReadyCheck || false,
      retryStrategy: config.retryStrategy,
    });

    cacheClient.on("error", (error) => {
      console.error("Cache connection error:", error);
    });

    cacheClient.on("connect", () => {
      console.log("Cache connected");
    });
  }

  return cacheClient;
}

/**
 * Close the cache Redis connection gracefully.
 * Should be called during application shutdown.
 */
export async function closeCacheClient(): Promise<void> {
  if (cacheClient) {
    try {
      await cacheClient.quit();
    } catch (error) {
      if ((error as Error).message?.includes("Connection is closed")) {
        return;
      }
      throw error;
    } finally {
      cacheClient = undefined;
    }
  }
}

export class CacheService {
  constructor(private client: Redis) {}

  /**
   * Get a value from cache.
   * Automatically parses JSON values.
   *
   * @param key - Cache key
   * @returns Cached value or null if not found
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  /**
   * Set a value in cache with optional TTL.
   *
   * @param key - Cache key
   * @param value - Value to cache (will be JSON serialized if not a string)
   * @param ttlSeconds - Optional time to live in seconds
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);

    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  /**
   * Delete a key from cache.
   *
   * @param key - Cache key to delete
   */
  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * Check if a key exists in cache.
   *
   * @param key - Cache key to check
   * @returns True if key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * Clear cache entries matching a pattern.
   * Use with caution - can be slow on large datasets.
   *
   * @param pattern - Key pattern to match (default: "*" for all keys)
   */
  async clear(pattern?: string): Promise<void> {
    const keys = await this.client.keys(pattern || "*");
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  /**
   * Increment a counter value.
   *
   * @param key - Counter key
   * @param by - Amount to increment (default: 1)
   * @returns New counter value
   */
  async increment(key: string, by: number = 1): Promise<number> {
    return await this.client.incrby(key, by);
  }

  /**
   * Decrement a counter value.
   *
   * @param key - Counter key
   * @param by - Amount to decrement (default: 1)
   * @returns New counter value
   */
  async decrement(key: string, by: number = 1): Promise<number> {
    return await this.client.decrby(key, by);
  }

  /**
   * Set TTL for an existing key.
   *
   * @param key - Cache key
   * @param seconds - TTL in seconds
   */
  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  /**
   * Get remaining TTL for a key.
   *
   * @param key - Cache key
   * @returns Remaining TTL in seconds, -1 if no expiry, -2 if key doesn't exist
   */
  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  /**
   * Set a field in a hash.
   *
   * @param key - Hash key
   * @param field - Field name
   * @param value - Field value
   */
  async hset(key: string, field: string, value: unknown): Promise<void> {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    await this.client.hset(key, field, serialized);
  }

  /**
   * Get a field from a hash.
   *
   * @param key - Hash key
   * @param field - Field name
   * @returns Field value or null if not found
   */
  async hget<T = unknown>(key: string, field: string): Promise<T | null> {
    const value = await this.client.hget(key, field);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  /**
   * Get all fields from a hash.
   *
   * @param key - Hash key
   * @returns Object with all field-value pairs
   */
  async hgetall<T = unknown>(key: string): Promise<Record<string, T>> {
    const values = await this.client.hgetall(key);
    const result: Record<string, T> = {};

    for (const [field, value] of Object.entries(values)) {
      try {
        result[field] = JSON.parse(value) as T;
      } catch {
        result[field] = value as T;
      }
    }

    return result;
  }

  /**
   * Delete fields from a hash.
   *
   * @param key - Hash key
   * @param fields - Field names to delete
   */
  async hdel(key: string, ...fields: string[]): Promise<void> {
    await this.client.hdel(key, ...fields);
  }
}

/**
 * Create a cache service instance with the given configuration.
 *
 * @param config - Cache configuration
 * @returns CacheService instance
 */
export function createCacheService(config: CacheConfig): CacheService {
  const client = getCacheClient(config);
  return new CacheService(client);
}
