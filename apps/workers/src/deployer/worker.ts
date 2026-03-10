/**
 * Deployer Worker
 * Processes deploy jobs from the queue
 */

import type { ILogger } from "@forge/core";
import { LoggerService } from "@forge/logger";
import type { LogLevel } from "@forge/core";
import { QueueService, type QueueConfig } from "@forge/queue";
import { handleDeployJob } from "./handlers/deploy.handler.js";

export interface DeployerWorkerOptions {
  concurrency?: number;
  limiter?: {
    max: number;
    duration: number;
  };
}

export class DeployerWorker {
  private queueService: QueueService;
  private logger: ILogger;
  private workerName = "deployer-worker";

  constructor(config: QueueConfig, options?: DeployerWorkerOptions) {
    this.logger = new LoggerService({
      level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
      format: process.env.NODE_ENV === "development" ? "pretty" : "json",
      enabled: true,
      name: this.workerName,
    });

    this.queueService = new QueueService(config);

    const worker = this.queueService.registerWorker("deploy", handleDeployJob, {
      concurrency: options?.concurrency ?? 5,
      limiter: options?.limiter ?? {
        max: 20,
        duration: 60_000,
      },
    });

    worker.onCompleted((job) => {
      this.logger.info("Deploy job completed", { jobId: job.id });
    });

    worker.onFailed((job, err) => {
      this.logger.error("Deploy job failed", { jobId: job?.id, error: err.message });
    });

    this.logger.info("Deployer worker initialized");
  }

  async close(): Promise<void> {
    this.logger.info("Shutting down deployer worker...");
    await this.queueService.close();
    this.logger.info("Deployer worker shut down");
  }
}
