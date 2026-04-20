import { randomUUID } from "node:crypto";
import type { Redis } from "ioredis";
import type { RedisConfig } from "./adapters/bullmq/redis";
import { getRedisConnection } from "./adapters/bullmq/redis";

export class RedisDeployLock {
  private readonly redis: Redis;

  constructor(
    redisConfig: RedisConfig,
    private readonly prefix = "forge:lock:deploy:"
  ) {
    this.redis = getRedisConnection(redisConfig, "queue");
  }

  async acquire(deploymentId: string, ttlMs = 300_000): Promise<string | null> {
    const key = `${this.prefix}${deploymentId}`;
    const token = randomUUID();

    const result = await this.redis.set(key, token, "PX", ttlMs, "NX");

    if (result === "OK") {
      return token;
    }

    return null;
  }

  async release(deploymentId: string, token: string): Promise<boolean> {
    const key = `${this.prefix}${deploymentId}`;

    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, 1, key, token);
    return result === 1;
  }

  async extend(deploymentId: string, token: string, ttlMs: number): Promise<boolean> {
    const key = `${this.prefix}${deploymentId}`;

    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, 1, key, token, ttlMs.toString());
    return result === 1;
  }

  async acquireProjectLock(projectId: string, ttlMs = 300_000): Promise<string | null> {
    const key = `${this.prefix}project:${projectId}`;
    const token = randomUUID();

    const result = await this.redis.set(key, token, "PX", ttlMs, "NX");

    if (result === "OK") {
      return token;
    }

    return null;
  }

  async releaseProjectLock(projectId: string, token: string): Promise<boolean> {
    const key = `${this.prefix}project:${projectId}`;

    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, 1, key, token);
    return result === 1;
  }

  async extendProjectLock(projectId: string, token: string, ttlMs: number): Promise<boolean> {
    const key = `${this.prefix}project:${projectId}`;

    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, 1, key, token, ttlMs.toString());
    return result === 1;
  }
}
