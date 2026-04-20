import type { ILogger } from "@forge/core";
import { LoggerService } from "@forge/logger";
import type { LogLevel } from "@forge/core";
import { QueueService, type QueueConfig } from "@forge/queue";
import { DockerRuntime } from "@forge/docker";
import path from "node:path";
import os from "node:os";
import type { IJobContext } from "@forge/queue";
import type { ServiceJobData } from "@forge/service-catalog";
import { LocalStorageProvider } from "@forge/storage";
import { handleProvision } from "./handlers/provision.handler.js";
import { handleDeprovision } from "./handlers/deprovision.handler.js";
import { handleStart } from "./handlers/start.handler.js";
import { handleStop } from "./handlers/stop.handler.js";
import { handleRestart } from "./handlers/restart.handler.js";
import { handleBackup } from "./handlers/backup.handler.js";
import { handleRestore } from "./handlers/restore.handler.js";
import { handleUpgrade } from "./handlers/upgrade.handler.js";

const BACKUP_STORAGE_PATH =
  process.env.BACKUP_STORAGE_PATH ?? path.join(os.homedir(), ".forge", "backups");

export interface ServiceProvisionerWorkerOptions {
  concurrency?: number;
  limiter?: {
    max: number;
    duration: number;
  };
}

export class ServiceProvisionerWorker {
  private queueService: QueueService;
  private logger: ILogger;
  private runtime: DockerRuntime;
  private storage: LocalStorageProvider;
  private workerName = "service-provisioner-worker";

  constructor(
    config: QueueConfig,
    private readonly options?: ServiceProvisionerWorkerOptions
  ) {
    this.logger = new LoggerService({
      level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
      format: process.env.NODE_ENV === "development" ? "pretty" : "json",
      enabled: true,
      name: this.workerName,
    });

    this.queueService = new QueueService(config);
    this.runtime = new DockerRuntime();
    this.storage = new LocalStorageProvider(BACKUP_STORAGE_PATH);

    this.logger.info("Service provisioner worker created — awaiting initialization");
  }

  async initialize(): Promise<void> {
    const worker = this.queueService.registerWorker(
      "services",
      (context: IJobContext<ServiceJobData>) => this.handleJob(context),
      {
        concurrency: this.options?.concurrency ?? 3,
        limiter: this.options?.limiter ?? {
          max: 10,
          duration: 60_000,
        },
      }
    );

    worker.onCompleted((job) => {
      this.logger.info("Service job completed", { jobId: job.id });
    });

    worker.onFailed((job, err) => {
      this.logger.error("Service job failed", { jobId: job?.id, error: err.message });
    });

    this.logger.info("Service provisioner worker initialized and ready");
  }

  private async handleJob(context: IJobContext<ServiceJobData>): Promise<void> {
    const { jobType, serviceId } = context.job.data;
    this.logger.info("Processing service job", { jobType, serviceId });

    switch (jobType) {
      case "PROVISION":
        await handleProvision(context, this.runtime);
        break;
      case "DEPROVISION":
        await handleDeprovision(context, this.runtime);
        break;
      case "START":
        await handleStart(context, this.runtime);
        break;
      case "STOP":
        await handleStop(context, this.runtime);
        break;
      case "RESTART":
        await handleRestart(context, this.runtime);
        break;
      case "BACKUP":
        await handleBackup(context, { runtime: this.runtime, storage: this.storage });
        break;
      case "RESTORE":
        await handleRestore(context, { runtime: this.runtime, storage: this.storage });
        break;
      case "UPGRADE":
        await handleUpgrade(context, { runtime: this.runtime });
        break;
      default:
        throw new Error(`Unknown service job type: ${jobType}`);
    }
  }

  async close(): Promise<void> {
    this.logger.info("Shutting down service provisioner worker...");
    await this.queueService.close();
    this.logger.info("Service provisioner worker shut down");
  }
}
