import type { ILogger } from "@forge/core";
import { LoggerService } from "@forge/logger";
import type { LogLevel } from "@forge/core";
import { QueueService, closeQueueService, type QueueConfig } from "@forge/queue";
import { handleNotifyJob } from "./handlers/notify.handler.js";

export interface NotificationWorkerOptions {
  concurrency?: number;
  limiter?: {
    max: number;
    duration: number;
  };
  lockDuration?: number;
}

export class NotificationWorker {
  private queueService: QueueService;
  private logger: ILogger;
  private workerName = "notification-worker";

  constructor(config: QueueConfig, options?: NotificationWorkerOptions) {
    this.logger = new LoggerService({
      level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
      format: process.env.NODE_ENV === "development" ? "pretty" : "json",
      enabled: true,
      name: this.workerName,
    });

    this.queueService = new QueueService(config);

    const worker = this.queueService.registerWorker("notifications", handleNotifyJob, {
      concurrency: options?.concurrency ?? 10,
      limiter: options?.limiter ?? {
        max: 50,
        duration: 60_000,
      },
      lockDuration: options?.lockDuration ?? 300_000,
    });

    worker.onCompleted((job) => {
      this.logger.info("Notification job completed", { jobId: job.id });
    });

    worker.onFailed((job, err) => {
      this.logger.error("Notification job failed", { jobId: job?.id, error: err.message });
    });

    this.logger.info("Notification worker initialized");
  }

  async close(): Promise<void> {
    this.logger.info("Shutting down notification worker...");
    await this.queueService.close();
    await closeQueueService();
    this.logger.info("Notification worker shut down");
  }
}
