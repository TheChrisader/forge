import type { ServiceContainer, ServiceModule, ConfigService } from "@forge/core";
import { SERVICE_KEY_STRINGS } from "@forge/core";
import { getDatabaseClient } from "@forge/database";
import Redis from "ioredis";
import { Queue } from "bullmq";

export class InfrastructureModule implements ServiceModule {
  private dbInstance?: ReturnType<typeof getDatabaseClient>;
  private redisInstance?: Redis;
  private queueRedisInstance?: Redis;
  private queueInstance?: Queue;

  async register(container: ServiceContainer): Promise<void> {
    const configService = await container.resolve<ConfigService>(SERVICE_KEY_STRINGS.CONFIG);
    const config = configService.getConfig();

    this.dbInstance = getDatabaseClient();
    container.singleton(SERVICE_KEY_STRINGS.DATABASE, () => this.dbInstance);

    this.redisInstance = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      keyPrefix: config.redis.keyPrefix,
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      enableReadyCheck: config.redis.enableReadyCheck,
      retryStrategy: (times: number): number => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redisInstance.on("error", (err: Error) => {
      console.error("Redis connection error:", err);
    });

    container.singleton(SERVICE_KEY_STRINGS.CACHE, () => this.redisInstance);

    this.queueRedisInstance = new Redis({
      host: config.queue.connection.host,
      port: config.queue.connection.port,
      password: config.queue.connection.password,
      db: config.queue.connection.db,
      maxRetriesPerRequest: null,
    });

    // Register Queue (this will be fully implemented in later tasks)
    // For now, register a stub that satisfies the interface
    this.queueInstance = new Queue("forge-deployments", {
      connection: this.queueRedisInstance,
      defaultJobOptions: config.queue.defaultJobOptions,
    });

    container.singleton(SERVICE_KEY_STRINGS.QUEUE, () => this.queueInstance);
  }

  async dispose(): Promise<void> {
    // Shutdown order matters: queue first, then queue Redis, then main Redis, then DB
    if (this.queueInstance) {
      await this.queueInstance.close();
    }

    if (this.queueRedisInstance) {
      await this.queueRedisInstance.quit();
    }

    if (this.redisInstance) {
      await this.redisInstance.quit();
    }

    if (this.dbInstance) {
      await this.dbInstance.$disconnect();
    }
  }
}
