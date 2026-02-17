import type { ServiceContainer } from "@forge/core";
import type { ServiceModule } from "@forge/core";
import { SERVICE_KEY_STRINGS } from "@forge/core";
import { getCacheClient, closeCacheClient, CacheConfig } from "./client";

export class CacheModule implements ServiceModule {
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  register(container: ServiceContainer): void {
    const cacheConfig: CacheConfig = {
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db || 1,
      keyPrefix: this.config.keyPrefix || "forge:cache:",
      maxRetriesPerRequest: this.config.maxRetriesPerRequest || 10,
      enableReadyCheck: this.config.enableReadyCheck || false,
      retryStrategy: this.config.retryStrategy || undefined,
    };

    container.singleton(SERVICE_KEY_STRINGS.CACHE, () => {
      return getCacheClient(cacheConfig);
    });
  }
}

export async function disposeCacheModule(container: ServiceContainer): Promise<void> {
  if (container.has(SERVICE_KEY_STRINGS.CACHE)) {
    await closeCacheClient();
  }
}
