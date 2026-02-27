/**
 * BullMQ worker adapter implementation
 */

import { Worker, Job } from "bullmq";
import type { JobInfo } from "@forge/types";
import type { IWorkerAdapter } from "../../domain/interfaces";
import type { QueueConfig, WorkerOptions } from "../../domain/types";
import { getRedisConnection, extractRedisConfig, type RedisConfig } from "./redis";

/**
 * Convert BullMQ Job to domain JobInfo
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toJobInfo<T>(bullmqJob: Job<T, any, string>): JobInfo<T> {
  return {
    id: bullmqJob.id!,
    name: bullmqJob.name,
    data: bullmqJob.data,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    opts: bullmqJob.opts as any,

    progress: bullmqJob.progress as number,
    attemptsMade: bullmqJob.attemptsMade,
    processedOn: bullmqJob.processedOn,
    finishedOn: bullmqJob.finishedOn,
    timestamp: bullmqJob.timestamp,
    failedReason: bullmqJob.failedReason,
    stacktrace: bullmqJob.stacktrace,
    returnvalue: bullmqJob.returnvalue,
  };
}

/**
 * Wrap a domain processor to convert BullMQ Job to JobInfo
 */
function wrapProcessor<T, R>(
  processor: (job: JobInfo<T>) => Promise<R>
): (job: Job<T, R, string>) => Promise<R> {
  return async (bullmqJob: Job<T, R, string>) => {
    const jobInfo = toJobInfo(bullmqJob);
    return processor(jobInfo);
  };
}

/**
 * Call a handler that may return void or Promise<void>, catching any errors
 */
function callHandlerSafely(
  handler: () => void | Promise<void>,
  errorMessage: string
): void {
  const result = handler();
  if (result && typeof result.then === "function") {
    // It's a Promise
    void result.catch((error: Error) => {
      console.error(errorMessage, error);
    });
  }
}

/**
 * BullMQ Worker Adapter
 */
export class BullMQWorkerAdapter implements IWorkerAdapter {
  private worker: Worker;
  private readonly redisConfig: RedisConfig;

  constructor(
    name: string,
    processor: (job: JobInfo<unknown>) => Promise<unknown>,
    config: QueueConfig,
    options?: WorkerOptions
  ) {
    this.redisConfig = extractRedisConfig(config.connection);
    const connection = getRedisConnection(this.redisConfig, "worker");

    this.worker = new Worker(name, wrapProcessor(processor), {
      connection,
      concurrency: options?.concurrency || 5,
      limiter: options?.limiter,
      lockDuration: options?.lockDuration || 30000,
      maxStalledCount: options?.maxStalledCount || 1,
      autorun: true,
    });
  }

  async pause(): Promise<void> {
    await this.worker.pause();
  }

  async resume(): Promise<void> {
    void this.worker.resume();
  }

  async close(): Promise<void> {
    await this.worker.close();
  }

  isRunning(): boolean {
    return this.worker.isRunning();
  }

  isPaused(): boolean {
    return this.worker.isPaused();
  }

  onCompleted<T, R>(handler: (job: JobInfo<T>, result: R) => void | Promise<void>): void {
    this.worker.on("completed", (bullmqJob: Job<T, R, string>, result: R) => {
      const jobInfo = toJobInfo(bullmqJob);
      callHandlerSafely(() => handler(jobInfo, result), "[Worker] onCompleted handler error:");
    });
  }

  onFailed<T>(handler: (job: JobInfo<T> | undefined, error: Error) => void | Promise<void>): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.worker.on("failed", (bullmqJob: Job<T, any, string> | undefined, error: Error) => {
      const jobInfo = bullmqJob ? toJobInfo(bullmqJob) : undefined;
      callHandlerSafely(() => handler(jobInfo, error), "[Worker] onFailed handler error:");
    });
  }

  onProgress<T>(
    handler: (job: JobInfo<T>, progress: number | object) => void | Promise<void>
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.worker.on("progress", (bullmqJob: Job<T, any, string>, progress: any) => {
      const jobInfo = toJobInfo(bullmqJob);
      callHandlerSafely(() => handler(jobInfo, progress), "[Worker] onProgress handler error:");
    });
  }

  /**
   * Get the raw BullMQ worker (for advanced use cases)
   * @internal
   */
  getRawWorker(): Worker {
    return this.worker;
  }

  /**
   * Get the redis config (for connection management)
   * @internal
   */
  getRedisConfig(): RedisConfig {
    return this.redisConfig;
  }
}
