/**
 * In-memory adapter factory
 */

import type {
  IQueueAdapterFactory,
  IQueueAdapter,
  IWorkerAdapter,
  IJobContext,
} from "../../domain/interfaces";
import type { QueueConfig, WorkerOptions, QueueOptions } from "../../domain/types";
import { InMemoryQueueAdapter } from "./queue.adapter";
import { InMemoryWorkerAdapter } from "./worker.adapter";

/**
 * In-memory Adapter Factory
 */
export class InMemoryAdapterFactory implements IQueueAdapterFactory {
  createQueue(name: string, config: QueueConfig, options?: QueueOptions): IQueueAdapter {
    return new InMemoryQueueAdapter(name, config, options);
  }

  createWorker<T, R>(
    name: string,
    processor: (context: IJobContext<T>) => Promise<R>,
    config: QueueConfig,
    options?: WorkerOptions
  ): IWorkerAdapter {
    return new InMemoryWorkerAdapter(
      name,
      processor as (context: IJobContext<unknown>) => Promise<unknown>,
      config,
      options
    );
  }
}
