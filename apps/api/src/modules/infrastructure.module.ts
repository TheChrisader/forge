import type { ServiceContainer, ServiceModule, ConfigService } from "@forge/core";
import { SERVICE_KEY_STRINGS } from "@forge/core";
import { DatabaseModule, disposeDatabaseModule } from "@forge/core";
import { CacheModule, disposeCacheModule } from "@forge/cache";
import { QueueModule, disposeQueueModule } from "@forge/queue";
import type { ILogger } from "@forge/core";

export class InfrastructureModule implements ServiceModule {
  private dbModule?: DatabaseModule;
  private cacheModule?: CacheModule;
  private queueModule?: QueueModule;
  private logger?: ILogger;
  private container?: ServiceContainer;

  async register(container: ServiceContainer): Promise<void> {
    this.container = container;
    const configService = await container.resolve<ConfigService>(SERVICE_KEY_STRINGS.CONFIG);
    const config = configService.getConfig();
    this.logger = await container.resolve<ILogger>(SERVICE_KEY_STRINGS.LOGGER);

    this.dbModule = new DatabaseModule();
    this.dbModule.register(container);
    this.logger.info("Database initialized");

    this.cacheModule = new CacheModule({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password ?? undefined,
      db: config.redis.db ?? undefined,
      keyPrefix: config.redis.keyPrefix ?? undefined,
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest ?? undefined,
      enableReadyCheck: config.redis.enableReadyCheck ?? undefined,
      retryStrategy: (times: number): number => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
    this.cacheModule.register(container);
    this.logger.info("Cache initialized");

    this.queueModule = new QueueModule({
      redis: {
        host: config.queue.connection.host,
        port: config.queue.connection.port,
        password: config.queue.connection.password ?? undefined,
        db: config.queue.connection.db ?? undefined,
      },
    });
    this.queueModule.register(container);
    this.logger.info("Queue initialized");
  }

  async dispose(): Promise<void> {
    // Shutdown order: queue, then cache, then database
    if (this.container) {
      if (this.queueModule) {
        await disposeQueueModule(this.container);
      }

      if (this.cacheModule) {
        await disposeCacheModule(this.container);
      }

      if (this.dbModule) {
        await disposeDatabaseModule(this.container);
      }
    }
  }
}
