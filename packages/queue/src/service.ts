import type { QueueConfig, QueueOptions } from "./client";
import {
  QueueClient,
  WorkerClient,
  closeAllRedisConnectionsForConfig,
  getActiveConnectionCount,
  type JobProcessor,
  type WorkerOptions,
} from "./client";
import type { JobOptions } from "./types";
import { QUEUE_NAMES } from "./queues";

export class QueueService {
  private queues = new Map<string, QueueClient>();
  private workers = new Map<string, WorkerClient>();
  private config: QueueConfig;

  constructor(config: QueueConfig) {
    this.config = config;
  }

  getQueue<T = unknown, R = unknown>(name: string, options?: QueueOptions): QueueClient<T, R> {
    if (!this.queues.has(name)) {
      const queue = new QueueClient<T, R>(name, this.config, options);

      this.queues.set(name, queue as QueueClient);
    }

    return this.queues.get(name) as QueueClient<T, R>;
  }

  registerWorker<T = unknown, R = unknown>(
    name: string,
    processor: JobProcessor<T, R>,
    options?: WorkerOptions
  ): WorkerClient<T, R> {
    if (this.workers.has(name)) {
      throw new Error(`Worker already registered for queue: ${name}`);
    }

    const worker = new WorkerClient<T, R>(name, processor, this.config, options);

    this.workers.set(name, worker as WorkerClient);

    return worker;
  }

  async addJob<T = unknown>(
    queueName: string,
    jobName: string,
    data: T,
    options?: JobOptions
  ): Promise<string> {
    const queue = this.getQueue<T>(queueName);
    const job = await queue.addJob(jobName, data, options);
    return job.id!;
  }

  async getHealth(queueName: string): Promise<{
    healthy: boolean;
    counts: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
      paused: number;
    };
    isPaused: boolean;
  }> {
    const queue = this.getQueue(queueName);
    const counts = await queue.getJobCounts();
    const isPaused = await queue.isPaused();

    const healthy = counts.failed < 100 && !isPaused;

    return {
      healthy,
      counts,
      isPaused,
    };
  }

  async getAllHealth(): Promise<Map<string, unknown>> {
    const healths = new Map();

    for (const queueName of Object.values(QUEUE_NAMES)) {
      const health = await this.getHealth(queueName);
      healths.set(queueName, health);
    }

    return healths;
  }

  async cleanQueues(grace: number = 24 * 3600 * 1000, limit: number = 1000): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.clean(grace, limit, "completed");
      await queue.clean(grace * 7, limit, "failed");
    }
  }

  async cleanDeadLetterQueues(
    grace: number = 7 * 24 * 3600 * 1000,
    limit: number = 1000
  ): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.cleanDeadLetterQueue(grace, limit);
    }
  }

  async pauseAll(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.pause();
    }
  }

  async resumeAll(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.resume();
    }
  }

  async close(): Promise<void> {
    for (const worker of this.workers.values()) {
      await worker.close();
    }
    this.workers.clear();

    for (const queue of this.queues.values()) {
      await queue.close();
    }
    this.queues.clear();

    await closeAllRedisConnectionsForConfig(this.config.redis);
  }

  async getMetrics(): Promise<{
    queues: number;
    workers: number;
    totalJobs: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
    connections: number;
  }> {
    let totalWaiting = 0;
    let totalActive = 0;
    let totalCompleted = 0;
    let totalFailed = 0;

    for (const queue of this.queues.values()) {
      const counts = await queue.getJobCounts();
      totalWaiting += counts.waiting;
      totalActive += counts.active;
      totalCompleted += counts.completed;
      totalFailed += counts.failed;
    }

    return {
      queues: this.queues.size,
      workers: this.workers.size,
      totalJobs: {
        waiting: totalWaiting,
        active: totalActive,
        completed: totalCompleted,
        failed: totalFailed,
      },
      connections: getActiveConnectionCount(),
    };
  }

  getConnectionHealth(): {
    activeConnections: number;
  } {
    return {
      activeConnections: getActiveConnectionCount(),
    };
  }

  /**
   * Subscribe to job progress events for a queue
   * @param queueName - Name of the queue to listen to
   * @param handler - Callback receiving event args from BullMQ QueueEvents
   */
  onProgress(queueName: string, handler: (...args: unknown[]) => void): void {
    const queue = this.getQueue(queueName);
    const events = queue.getEvents();
    events.on("progress", handler);
  }

  /**
   * Subscribe to job completed events for a queue
   * @param queueName - Name of the queue to listen to
   * @param handler - Callback receiving event args from BullMQ QueueEvents
   */
  onCompleted(queueName: string, handler: (...args: unknown[]) => void): void {
    const queue = this.getQueue(queueName);
    const events = queue.getEvents();
    events.on("completed", handler);
  }

  /**
   * Subscribe to job failed events for a queue
   * @param queueName - Name of the queue to listen to
   * @param handler - Callback receiving event args from BullMQ QueueEvents
   */
  onFailed(queueName: string, handler: (...args: unknown[]) => void): void {
    const queue = this.getQueue(queueName);
    const events = queue.getEvents();
    events.on("failed", handler);
  }
}

let queueService: QueueService | undefined;

export function getQueueService(config: QueueConfig): QueueService {
  if (!queueService) {
    queueService = new QueueService(config);
  }
  return queueService;
}

export async function closeQueueService(): Promise<void> {
  if (queueService) {
    await queueService.close();
    queueService = undefined;
  }
}
