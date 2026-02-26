/**
 * Deployer Worker
 * Processes deploy jobs from the queue
 */

import pino from "pino";
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
  private logger: pino.Logger;
  private workerName = "deployer-worker";

  constructor(config: QueueConfig, options?: DeployerWorkerOptions) {
    this.logger = pino({
      name: this.workerName,
      level: process.env.LOG_LEVEL ?? "info",
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
      this.logger.info({ jobId: job.id }, "Deploy job completed");
    });

    worker.onFailed((job, err) => {
      this.logger.error({ jobId: job?.id, error: err.message }, "Deploy job failed");
    });

    this.logger.info("Deployer worker initialized");
  }

  async close(): Promise<void> {
    this.logger.info("Shutting down deployer worker...");
    await this.queueService.close();
    this.logger.info("Deployer worker shut down");
  }
}
