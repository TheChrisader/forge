import type { ServiceContainer, ServiceModule, ConfigService } from "@forge/core";
import { SERVICE_KEY_STRINGS } from "@forge/core";
import { getDatabaseClient } from "@forge/database";
import Redis from "ioredis";
import { QueueService } from "@forge/queue";
import type { QueueConfig } from "@forge/queue";
import pino from "pino";

export class InfrastructureModule implements ServiceModule {
  private dbInstance?: ReturnType<typeof getDatabaseClient>;
  private redisInstance?: Redis;
  private queueService?: QueueService;
  private logger?: pino.Logger;

  async register(container: ServiceContainer): Promise<void> {
    const configService = await container.resolve<ConfigService>(SERVICE_KEY_STRINGS.CONFIG);
    const config = configService.getConfig();
    this.logger = await container.resolve<pino.Logger>(SERVICE_KEY_STRINGS.LOGGER);

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
      this.logger?.error({ err }, "Redis connection error");
    });

    container.singleton(SERVICE_KEY_STRINGS.CACHE, () => this.redisInstance);

    const queueConfig: QueueConfig = {
      redis: {
        host: config.queue.connection.host,
        port: config.queue.connection.port,
        password: config.queue.connection.password,
        db: config.queue.connection.db,
      },
    };

    this.queueService = new QueueService(queueConfig);

    container.singleton(SERVICE_KEY_STRINGS.JOB_QUEUE, () => this.queueService);
  }

  async dispose(): Promise<void> {
    // Shutdown order: queue service first (manages its own Redis), then main Redis, then DB
    if (this.queueService) {
      await this.queueService.close();
    }

    if (this.redisInstance) {
      await this.redisInstance.quit();
    }

    if (this.dbInstance) {
      await this.dbInstance.$disconnect();
    }
  }
}
