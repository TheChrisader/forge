import type { ServiceContainer } from "@forge/core";
import type { ServiceModule } from "@forge/core";
import { SERVICE_KEY_STRINGS } from "@forge/core";
import { getQueueService, closeQueueService } from "./services/queue.service";
import type { QueueConfig } from "./domain/types";

/**
 * Queue module configuration
 */
export interface QueueModuleConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
}

/**
 * Queue Module
 */
export class QueueModule implements ServiceModule {
  private config: QueueConfig;

  constructor(config: QueueModuleConfig) {
    this.config = {
      connection: {
        type: "redis",
        redis: config.redis,
      },
    };
  }

  register(container: ServiceContainer): void {
    container.singleton(SERVICE_KEY_STRINGS.QUEUE, () => {
      return getQueueService(this.config);
    });
  }
}

export async function disposeQueueModule(container: ServiceContainer): Promise<void> {
  if (container.has(SERVICE_KEY_STRINGS.QUEUE)) {
    await closeQueueService();
  }
}
