/**
 * Adapter factory
 */

import type { IQueueAdapterFactory } from "./domain/interfaces";
import type { QueueConfig } from "./domain/types";
import { BullMQAdapterFactory } from "./adapters/bullmq/factory";
import { InMemoryAdapterFactory } from "./adapters/memory/factory";

export function createAdapterFactory(config: QueueConfig): IQueueAdapterFactory {
  const connectionType = config.connection.type;

  switch (connectionType) {
    case "redis":
      return new BullMQAdapterFactory(config);

    case "memory":
      return new InMemoryAdapterFactory();

    default: {
      // TypeScript exhaustive check - ensures we handle all connection types
      const _exhaustive: never = connectionType;
      throw new Error(`Unsupported connection type: ${_exhaustive}`);
    }
  }
}
