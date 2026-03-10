/**
 * Build worker
 * Processes build jobs from the queue
 */

import type { ILogger } from "@forge/core";
import { LoggerService } from "@forge/logger";
import type { LogLevel } from "@forge/core";
import { QueueService, type QueueConfig } from "@forge/queue";
import { handleBuildJob } from "./handlers/build.handler.js";

export interface BuildWorkerOptions {
  concurrency?: number;
  limiter?: {
    max: number;
    duration: number;
  };
  lockDuration?: number;
}

export class BuildWorker {
  private queueService: QueueService;
  private logger: ILogger;
  private workerName = "build-worker";

  constructor(config: QueueConfig, options?: BuildWorkerOptions) {
    this.logger = new LoggerService({
      level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
      format: process.env.NODE_ENV === "development" ? "pretty" : "json",
      enabled: true,
      name: this.workerName,
    });

    this.queueService = new QueueService(config);

    const worker = this.queueService.registerWorker("build", handleBuildJob, {
      concurrency: options?.concurrency ?? 3,
      limiter: options?.limiter ?? {
        max: 10,
        duration: 60_000,
      },
      lockDuration: options?.lockDuration ?? 40 * 60 * 1000, // 40 minutes default
    });

    worker.onCompleted((job) => {
      this.logger.info("Build job completed", { jobId: job.id });
    });

    worker.onFailed((job, err) => {
      this.logger.error("Build job failed", { jobId: job?.id, error: err.message });
    });

    this.logger.info("Build worker initialized");
  }

  async close(): Promise<void> {
    this.logger.info("Shutting down build worker...");
    await this.queueService.close();
    this.logger.info("Build worker shut down");
  }
}
