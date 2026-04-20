/**
 * @forge/queue
 *
 * Queue package providing a clean adapter pattern over BullMQ
 */

export type { JobOptions, BackoffOptions, JobStatus, JobInfo } from "@forge/types";

export type {
  QueueConfig,
  QueueConnectionConfig,
  QueueHealth,
  WorkerOptions,
  QueueOptions,
  BulkJob,
} from "./domain/types";

export type {
  IQueueAdapter,
  IWorkerAdapter,
  IEventEmitter,
  IQueueAdapterFactory,
  IJobContext,
} from "./domain/interfaces";

export { createAdapterFactory } from "./factory";

export { QueueService, getQueueService, closeQueueService } from "./services/queue.service";

export { QueueMonitor, type QueueMetrics } from "./services/monitor.service";

export { QUEUE_NAMES, type QueueName } from "./constants";

export { QueueError, QueueConnectionError, QueueJobError } from "./errors";

export { QueueModule, disposeQueueModule, type QueueModuleConfig } from "./module";

export { RedisDeployLock } from "./redis-lock";

/**
 * @deprecated Use QueueConfig from './domain/types' instead
 */
export type { RedisConfig } from "./domain/types";

export type {
  BuildJobData,
  DeployJobData,
  ScheduledJobData,
  WebhookJobData,
  NotificationJobData,
  BuildJobResult,
  DeployJobResult,
  JobResult,
} from "@forge/types";
