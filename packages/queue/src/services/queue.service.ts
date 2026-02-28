import type { JobOptions } from "@forge/types";
import type { IQueueAdapter, IWorkerAdapter, IJobContext } from "../domain/interfaces";
import type { QueueConfig, WorkerOptions, QueueOptions, QueueHealth } from "../domain/types";
import { createAdapterFactory } from "../factory";
import { QUEUE_NAMES } from "../constants";
import {
  closeAllRedisConnectionsForConfig,
  getActiveConnectionCount,
  extractRedisConfig,
} from "../adapters/bullmq/redis";

export class QueueService {
  private queues = new Map<string, IQueueAdapter>();
  private workers = new Map<string, IWorkerAdapter>();
  private readonly config: QueueConfig;

  constructor(config: QueueConfig) {
    this.config = config;
  }

  /**
   * Get or create a queue adapter
   */
  getQueue<_T = unknown, _R = unknown>(name: string, options?: QueueOptions): IQueueAdapter {
    if (!this.queues.has(name)) {
      const adapterFactory = createAdapterFactory(this.config);
      const queue = adapterFactory.createQueue(name, this.config, options);
      this.queues.set(name, queue);
    }

    return this.queues.get(name)!;
  }

  /**
   * Register a worker for a queue
   */
  registerWorker<T = unknown, R = unknown>(
    name: string,
    processor: (context: IJobContext<T>) => Promise<R>,
    options?: WorkerOptions
  ): IWorkerAdapter {
    if (this.workers.has(name)) {
      throw new Error(`Worker already registered for queue: ${name}`);
    }

    const adapterFactory = createAdapterFactory(this.config);
    const worker = adapterFactory.createWorker<T, R>(name, processor, this.config, options);

    this.workers.set(name, worker);
    return worker;
  }

  /**
   * Add a job to a queue
   */
  async addJob<T = unknown>(
    queueName: string,
    jobName: string,
    data: T,
    options?: JobOptions
  ): Promise<string> {
    const queue = this.getQueue<T>(queueName);
    return queue.add(jobName, data, options);
  }

  /**
   * Get health status for a queue
   */
  async getHealth(queueName: string): Promise<QueueHealth> {
    const queue = this.getQueue(queueName);
    const counts = await queue.getJobCounts();
    const isPaused = await queue.isPaused();

    const healthy = counts.failed < 100 && !isPaused;

    return {
      healthy,
      counts: {
        ...counts,
        paused: 0,
      },
      isPaused,
    };
  }

  /**
   * Get health status for all queues
   */
  async getAllHealth(): Promise<Map<string, QueueHealth>> {
    const healths = new Map<string, QueueHealth>();

    for (const queueName of Object.values(QUEUE_NAMES)) {
      try {
        const health = await this.getHealth(queueName);
        healths.set(queueName, health);
      } catch {
        // Queue may not be initialized yet
      }
    }

    return healths;
  }

  /**
   * Clean old jobs from all queues
   */
  async cleanQueues(grace: number = 24 * 3600 * 1000, limit: number = 1000): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.clean(grace, limit, "completed");
      await queue.clean(grace * 7, limit, "failed");
    }
  }

  /**
   * Clean dead letter queues
   */
  async cleanDeadLetterQueues(
    grace: number = 7 * 24 * 3600 * 1000,
    limit: number = 1000
  ): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.clean(grace, limit, "failed");
    }
  }

  /**
   * Pause all queues
   */
  async pauseAll(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.pause();
    }
  }

  /**
   * Resume all queues
   */
  async resumeAll(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.resume();
    }
  }

  /**
   * Close all queues and workers
   */
  async close(): Promise<void> {
    for (const worker of this.workers.values()) {
      await worker.close();
    }
    this.workers.clear();

    for (const queue of this.queues.values()) {
      await queue.close();
    }
    this.queues.clear();

    if (this.config.connection.type === "redis") {
      const redisConfig = extractRedisConfig(this.config.connection);
      await closeAllRedisConnectionsForConfig(redisConfig);
    }
  }

  /**
   * Get metrics for all queues
   */
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

  /**
   * Get connection health
   */
  getConnectionHealth(): {
    activeConnections: number;
  } {
    return {
      activeConnections: getActiveConnectionCount(),
    };
  }

  /**
   * Subscribe to job progress events for a queue
   */
  onProgress(queueName: string, handler: (...args: unknown[]) => void): void {
    const queue = this.getQueue(queueName);
    const events = queue.getEvents();
    events.onProgress(handler);
  }

  /**
   * Subscribe to job completed events for a queue
   */
  onCompleted(queueName: string, handler: (...args: unknown[]) => void): void {
    const queue = this.getQueue(queueName);
    const events = queue.getEvents();
    events.onCompleted(handler);
  }

  /**
   * Subscribe to job failed events for a queue
   */
  onFailed(queueName: string, handler: (...args: unknown[]) => void): void {
    const queue = this.getQueue(queueName);
    const events = queue.getEvents();
    events.onFailed(handler);
  }

  /**
   * Get a worker by name
   */
  getWorker(name: string): IWorkerAdapter | undefined {
    return this.workers.get(name);
  }

  /**
   * Get all registered workers
   */
  getAllWorkers(): Map<string, IWorkerAdapter> {
    return new Map(this.workers);
  }

  /**
   * Get all queues
   */
  getAllQueues(): Map<string, IQueueAdapter> {
    return new Map(this.queues);
  }
}

let queueService: QueueService | undefined;

/**
 * Get the singleton queue service instance
 */
export function getQueueService(config: QueueConfig): QueueService {
  if (!queueService) {
    queueService = new QueueService(config);
  }
  return queueService;
}

/**
 * Close the singleton queue service instance
 */
export async function closeQueueService(): Promise<void> {
  if (queueService) {
    await queueService.close();
    queueService = undefined;
  }
}
