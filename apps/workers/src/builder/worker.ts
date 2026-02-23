/**
 * Build worker
 * Processes build jobs from the queue
 */

import pino from "pino";
import { QueueService, type QueueConfig } from "@forge/queue";
import { handleBuildJob } from "./handlers/build.handler.js";

export interface BuildWorkerOptions {
  concurrency?: number;
  limiter?: {
    max: number;
    duration: number;
  };
}

export class BuildWorker {
  private queueService: QueueService;
  private logger: pino.Logger;
  private workerName = "build-worker";

  constructor(config: QueueConfig, options?: BuildWorkerOptions) {
    this.logger = pino({
      name: this.workerName,
      level: process.env.LOG_LEVEL ?? "info",
    });

    this.queueService = new QueueService(config);

    const worker = this.queueService.registerWorker("build", handleBuildJob, {
      concurrency: options?.concurrency ?? 3,
      limiter: options?.limiter ?? {
        max: 10,
        duration: 60_000,
      },
    });

    worker.onCompleted((job) => {
      this.logger.info({ jobId: job.id }, "Build job completed");
    });

    worker.onFailed((job, err) => {
      this.logger.error({ jobId: job?.id, error: err.message }, "Build job failed");
    });

    this.logger.info("Build worker initialized");
  }

  async close(): Promise<void> {
    this.logger.info("Shutting down build worker...");
    await this.queueService.close();
    this.logger.info("Build worker shut down");
  }
}
