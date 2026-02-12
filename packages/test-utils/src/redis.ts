import { RedisContainer, StartedRedisContainer } from "@testcontainers/redis";
import Redis from "ioredis";

/**
 * Test Redis manager using Testcontainers
 * Provides isolated Redis instances for integration testing
 */
export class TestRedis {
  private container?: StartedRedisContainer;
  private client?: Redis;

  async start(): Promise<void> {
    this.container = await new RedisContainer("redis:7-alpine").start();

    const host = this.container.getHost();
    const port = this.container.getPort();

    this.client = new Redis({
      host,
      port,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    await this.client.ping();

    process.env.REDIS_HOST = host;
    process.env.REDIS_PORT = port.toString();
  }

  async stop(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = undefined;
    }

    if (this.container) {
      await this.container.stop();
      this.container = undefined;
    }
  }

  async reset(): Promise<void> {
    if (!this.client) {
      throw new Error("Redis not started. Call start() first.");
    }
    await this.client.flushall();
  }

  getClient(): Redis {
    if (!this.client) {
      throw new Error("Redis not started. Call start() first.");
    }
    return this.client;
  }

  getConfig(): { host: string; port: number } {
    if (!this.container) {
      throw new Error("Redis not started. Call start() first.");
    }

    return {
      host: this.container.getHost(),
      port: this.container.getPort(),
    };
  }

  getContainer(): StartedRedisContainer {
    if (!this.container) {
      throw new Error("Redis not started. Call start() first.");
    }
    return this.container;
  }
}
