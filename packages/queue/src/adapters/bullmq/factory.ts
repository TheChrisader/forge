/**
 * BullMQ adapter factory
 */

import type { IQueueAdapterFactory, IQueueAdapter, IWorkerAdapter } from "../../domain/interfaces";
import type { QueueConfig, WorkerOptions, QueueOptions } from "../../domain/types";
import type { JobInfo } from "@forge/types";
import { BullMQQueueAdapter } from "./queue.adapter";
import { BullMQWorkerAdapter } from "./worker.adapter";

/**
 * BullMQ Adapter Factory
 */
export class BullMQAdapterFactory implements IQueueAdapterFactory {
  constructor(private readonly config: QueueConfig) {}

  createQueue(name: string, _config: QueueConfig, options?: QueueOptions): IQueueAdapter {
    return new BullMQQueueAdapter(name, this.config, options);
  }

  createWorker<T, R>(
    name: string,
    processor: (job: JobInfo<T>) => Promise<R>,
    _config: QueueConfig,
    options?: WorkerOptions
  ): IWorkerAdapter {
    return new BullMQWorkerAdapter(
      name,
      processor as (job: JobInfo<unknown>) => Promise<unknown>,
      this.config,
      options
    );
  }
}
