import { Queue, JobsOptions } from "bullmq";
import type { JobOptions, JobStatus, JobInfo } from "@forge/types";
import type { IQueueAdapter, IEventEmitter } from "../../domain/interfaces";
import type { QueueConfig, QueueOptions } from "../../domain/types";
import { getRedisConnection, extractRedisConfig, type RedisConfig } from "./redis";
import { BullMQEventEmitterAdapter } from "./events.adapter";

function toBullMQJobOptions(options?: JobOptions): JobsOptions | undefined {
  if (!options) {
    return undefined;
  }
  return options as JobsOptions;
}

function toJobInfo<T>(
  job: { id?: string; name: string; data: T } | null | undefined
): JobInfo<T> | undefined {
  if (!job) {
    return undefined;
  }
  return job as JobInfo<T>;
}

export class BullMQQueueAdapter implements IQueueAdapter {
  private queue: Queue;
  private events?: BullMQEventEmitterAdapter;
  private readonly redisConfig: RedisConfig;

  constructor(name: string, config: QueueConfig, options?: QueueOptions) {
    this.redisConfig = extractRedisConfig(config.connection);
    const queueConnection = getRedisConnection(this.redisConfig, "queue");

    this.queue = new Queue(name, {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: options?.defaultJobOptions?.attempts || 3,
        backoff: options?.defaultJobOptions?.backoff || {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: options?.defaultJobOptions?.removeOnComplete ?? {
          count: 100,
          age: 24 * 3600,
        },
        removeOnFail: options?.defaultJobOptions?.removeOnFail ?? {
          count: 1000,
        },
      },
    });

    if (options?.deadLetter) {
      this.setupDeadLetterQueue(name, queueConnection, options.deadLetter);
    }

    const eventsConnection = getRedisConnection(this.redisConfig, "events");
    this.events = new BullMQEventEmitterAdapter(name, eventsConnection);
  }

  private setupDeadLetterQueue(
    name: string,
    connection: ReturnType<typeof getRedisConnection>,
    deadLetterConfig: NonNullable<QueueOptions["deadLetter"]>
  ): void {
    const dlqName = deadLetterConfig.queueName || `${name}:dead-letter`;

    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
    const { Queue: BullMQQueue } = require("bullmq");

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const dlq = new BullMQQueue(dlqName, {
      connection,
      defaultJobOptions: {
        removeOnComplete: deadLetterConfig.limit || 10000,
        removeOnFail: false,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    (this.queue as any).on("failed", async (job: any, error: Error) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await dlq.add(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `${job.name}-failed`,
          {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            originalJobId: job.id,
            originalQueue: name,
            failedReason: error.message,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            stacktrace: job.stacktrace,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            data: job.data,
            failedAt: new Date().toISOString(),
          },
          {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            jobId: `${job.id}-dlq`,
          }
        );
      }
    });
  }

  async add<T>(name: string, data: T, options?: JobOptions): Promise<string> {
    const job = await this.queue.add(name, data, toBullMQJobOptions(options));
    return job.id!;
  }

  async addBulk<T>(jobs: Array<{ name: string; data: T; opts?: JobOptions }>): Promise<string[]> {
    const bullmqJobs = jobs.map((job) => ({
      name: job.name,
      data: job.data,
      opts: toBullMQJobOptions(job.opts),
    }));
    const addedJobs = await this.queue.addBulk(bullmqJobs);
    return addedJobs.map((job) => job.id!);
  }

  async getJob<T>(jobId: string): Promise<JobInfo<T> | undefined> {
    const job = await this.queue.getJob(jobId);
    return toJobInfo<T>(job);
  }

  async getJobCounts(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const counts = await this.queue.getJobCounts();
    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
    };
  }

  async getJobs<T>(status: JobStatus, start?: number, end?: number): Promise<JobInfo<T>[]> {
    if (status === "paused") {
      const jobs = await this.queue.getWaiting(start, end);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      return jobs.map((job: any) => toJobInfo<T>(job)) as JobInfo<T>[];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statusMap: Record<string, () => Promise<any[]>> = {
      waiting: () => this.queue.getWaiting(start, end),
      active: () => this.queue.getActive(start, end),
      completed: () => this.queue.getCompleted(start, end),
      failed: () => this.queue.getFailed(start, end),
      delayed: () => this.queue.getDelayed(start, end),
    };

    const getter = statusMap[status];
    if (!getter) {
      throw new Error(`Unsupported job status: ${status}`);
    }

    const jobs = await getter();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    return jobs.map((job: any) => toJobInfo<T>(job)) as JobInfo<T>[];
  }

  async removeJob(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.remove();
    }
  }

  async retryJob(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.retry();
    }
  }

  async clean(grace: number, limit: number, status: "completed" | "failed"): Promise<string[]> {
    return this.queue.clean(grace, limit, status);
  }

  async pause(): Promise<void> {
    await this.queue.pause();
  }

  async resume(): Promise<void> {
    await this.queue.resume();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async isPaused(): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
    return (this.queue as any).isPaused();
  }

  async obliterate(options?: { force: boolean }): Promise<void> {
    await this.queue.obliterate(options);
  }

  getEvents(): IEventEmitter {
    if (!this.events) {
      throw new Error("Events not initialized");
    }
    return this.events;
  }

  async close(): Promise<void> {
    await this.queue.close();
    if (this.events) {
      await this.events.close();
    }
  }

  /**
   * Get the raw BullMQ queue (for advanced use cases)
   * @internal
   */
  getRawQueue(): Queue {
    return this.queue;
  }

  /**
   * Get the redis config (for connection management)
   * @internal
   */
  getRedisConfig(): RedisConfig {
    return this.redisConfig;
  }
}
