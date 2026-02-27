import { Queue, Worker, QueueEvents, Job, JobsOptions } from "bullmq";
import Redis from "ioredis";
import type { JobOptions, JobStatus } from "./types";

function toBullMQJobOptions(options?: JobOptions): JobsOptions | undefined {
  return options as JobsOptions;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export interface QueueConfig {
  redis: RedisConfig;
}

class RedisConnectionManager {
  private connections = new Map<string, Redis>();

  getConnection(config: RedisConfig, usage: "queue" | "worker" | "events" = "queue"): Redis {
    const key = this.getConfigKey(config, usage);

    if (!this.connections.has(key)) {
      const connection = new Redis({
        host: config.host,
        port: config.port,
        password: config.password,
        db: config.db || 0,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      connection.on("error", (error) => {
        console.error(`Redis connection error [${key}]:`, error);
      });

      connection.on("ready", () => {
        if (connection.status === "ready") {
          console.log(`Redis ready [${key}]`);
        }
      });

      this.connections.set(key, connection);
    }

    return this.connections.get(key)!;
  }

  async closeConnection(
    config: RedisConfig,
    usage: "queue" | "worker" | "events" = "queue"
  ): Promise<void> {
    const key = this.getConfigKey(config, usage);
    const connection = this.connections.get(key);

    if (connection) {
      try {
        await connection.quit();
      } catch {}
      this.connections.delete(key);
    }
  }

  async closeAllForConfig(config: RedisConfig): Promise<void> {
    const prefix = this.getConfigKey(config, "");
    const connectionsToClose: Array<{ key: string; conn: Redis }> = [];

    for (const [key, connection] of this.connections.entries()) {
      if (key.startsWith(prefix)) {
        connectionsToClose.push({ key, conn: connection });
      }
    }

    await Promise.all(
      connectionsToClose.map(async ({ conn }) => {
        try {
          await conn.quit();
        } catch {}
      })
    );

    for (const { key } of connectionsToClose) {
      this.connections.delete(key);
    }
  }

  async closeAll(): Promise<void> {
    const connections = Array.from(this.connections.entries());

    await Promise.all(
      connections.map(async ([, conn]) => {
        try {
          await conn.quit();
        } catch {}
      })
    );

    this.connections.clear();
  }

  getActiveConnections(): number {
    return this.connections.size;
  }

  private getConfigKey(config: RedisConfig, usage: string): string {
    const configKey = `${config.host}:${config.port}:${config.db || 0}`;
    return usage ? `${configKey}:${usage}` : configKey;
  }
}

const connectionManager = new RedisConnectionManager();

export function getRedisConnection(
  config: RedisConfig,
  usage: "queue" | "worker" | "events" = "queue"
): Redis {
  return connectionManager.getConnection(config, usage);
}

export async function closeRedisConnection(
  config: RedisConfig,
  usage: "queue" | "worker" | "events" = "queue"
): Promise<void> {
  await connectionManager.closeConnection(config, usage);
}

export async function closeAllRedisConnectionsForConfig(config: RedisConfig): Promise<void> {
  await connectionManager.closeAllForConfig(config);
}

export async function closeAllRedisConnections(): Promise<void> {
  await connectionManager.closeAll();
}

export function getActiveConnectionCount(): number {
  return connectionManager.getActiveConnections();
}

export interface QueueOptions {
  defaultJobOptions?: JobOptions;
  limiter?: {
    max: number;
    duration: number;
  };

  deadLetter?: {
    queueName?: string;
    limit?: number;
  };
}

export class QueueClient<T = unknown, R = unknown> {
  private queue: Queue<T, R, string>;
  private events?: QueueEvents;
  private config: QueueConfig;

  constructor(name: string, config: QueueConfig, options?: QueueOptions) {
    this.config = config;
    const queueConnection = getRedisConnection(config.redis, "queue");

    this.queue = new Queue<T, R, string>(name, {
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

    const eventsConnection = getRedisConnection(config.redis, "events");
    this.events = new QueueEvents(name, { connection: eventsConnection });
  }

  private setupDeadLetterQueue(
    name: string,
    connection: Redis,
    deadLetterConfig: NonNullable<QueueOptions["deadLetter"]>
  ): void {
    const dlqName = deadLetterConfig.queueName || `${name}:dead-letter`;

    const dlq = new Queue<T, R, string>(dlqName, {
      connection,
      defaultJobOptions: {
        removeOnComplete: deadLetterConfig.limit || 10000,
        removeOnFail: false,
      },
    });

    (this.queue as any).on("failed", async (job: Job<T, R, string> | undefined, error: Error) => {
      if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
        await dlq.add(
          `${job.name}-failed` as any,
          {
            originalJobId: job.id,
            originalQueue: name,
            failedReason: error.message,
            stacktrace: job.stacktrace,
            data: job.data,
            failedAt: new Date().toISOString(),
          } as any,
          {
            jobId: `${job.id}-dlq`,
          }
        );
      }
    });
  }

  async addJob(name: string, data: T, options?: JobOptions): Promise<Job<T, R, string>> {
    return this.queue.add(name as any, data as any, toBullMQJobOptions(options)) as any;
  }

  async addBulk(
    jobs: Array<{ name: string; data: T; opts?: JobOptions }>
  ): Promise<Job<T, R, string>[]> {
    const bullmqJobs = jobs.map((job) => ({
      name: job.name,
      data: job.data,
      opts: toBullMQJobOptions(job.opts),
    }));
    return this.queue.addBulk(bullmqJobs as any) as any;
  }

  async getJob(jobId: string): Promise<Job<T, R, string> | undefined> {
    return this.queue.getJob(jobId) as any;
  }

  async getJobCounts(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    const counts = await this.queue.getJobCounts();
    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      paused: 0,
    };
  }

  async getJobs(status: JobStatus, start?: number, end?: number): Promise<Job<T, R, string>[]> {
    if (status === "paused") {
      return (this.queue as any).getPaused(start, end);
    }

    const statusMap: Record<string, () => Promise<any>> = {
      waiting: () => this.queue.getWaiting(start, end),
      active: () => this.queue.getActive(start, end),
      completed: () => this.queue.getCompleted(start, end),
      failed: () => this.queue.getFailed(start, end),
      delayed: () => this.queue.getDelayed(start, end),
    };

    return statusMap[status]() as Promise<Job<T, R, string>[]>;
  }

  async removeJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) {
      await job.remove();
    }
  }

  async retryJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
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

  async isPaused(): Promise<boolean> {
    return (this.queue as any).isPaused();
  }

  async obliterate(options?: { force: boolean }): Promise<void> {
    await this.queue.obliterate(options);
  }

  getEvents(): QueueEvents {
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

  getQueue(): Queue<T, R, string> {
    return this.queue;
  }

  async getDeadLetterJobs(start = 0, end = 10): Promise<Job<T, R, string>[]> {
    const dlqName = `${this.queue.name}:dead-letter`;

    const dlq = new Queue<T, R, string>(dlqName, {
      connection: getRedisConnection(this.config.redis, "queue"),
    });
    const jobs = await dlq.getFailed(start, end);
    await dlq.close();
    return jobs as Job<T, R, string>[];
  }

  async retryDeadLetterJob(dlqJobId: string): Promise<void> {
    const dlqName = `${this.queue.name}:dead-letter`;

    const dlq = new Queue<T, R, string>(dlqName, {
      connection: getRedisConnection(this.config.redis, "queue"),
    });
    const job = await dlq.getJob(dlqJobId);
    if (job) {
      await job.remove();
      if (job.data.originalQueue) {
        await this.queue.add(job.data.originalQueue, job.data.data);
      }
    }
    await dlq.close();
  }

  async cleanDeadLetterQueue(grace = 7 * 24 * 3600 * 1000, limit = 1000): Promise<string[]> {
    const dlqName = `${this.queue.name}:dead-letter`;

    const dlq = new Queue<T, R, string>(dlqName, {
      connection: getRedisConnection(this.config.redis, "queue"),
    });
    const result = await dlq.clean(grace, limit, "failed");
    await dlq.close();
    return result;
  }
}

export interface WorkerOptions {
  concurrency?: number;
  limiter?: {
    max: number;
    duration: number;
  };
  lockDuration?: number;
  maxStalledCount?: number;
}

export type JobProcessor<T = unknown, R = unknown> = (job: Job<T, R, string>) => Promise<R>;

export class WorkerClient<T = unknown, R = unknown> {
  private worker: Worker<T, R, string>;
  private readonly config: QueueConfig;

  constructor(
    name: string,
    processor: JobProcessor<T, R>,
    config: QueueConfig,
    options?: WorkerOptions
  ) {
    this.config = config;
    const connection = getRedisConnection(config.redis, "worker");

    this.worker = new Worker<T, R, string>(name, processor as any, {
      connection,
      concurrency: options?.concurrency || 5,
      limiter: options?.limiter,
      lockDuration: options?.lockDuration || 30000,
      maxStalledCount: options?.maxStalledCount || 1,
      autorun: true,
    });
  }

  async pause(): Promise<void> {
    await this.worker.pause();
  }

  async resume(): Promise<void> {
    await this.worker.resume();
  }

  async close(): Promise<void> {
    await this.worker.close();
  }

  getWorker(): Worker<T, R, string> {
    return this.worker;
  }

  isRunning(): boolean {
    return this.worker.isRunning();
  }

  isPaused(): boolean {
    return this.worker.isPaused();
  }

  onCompleted(handler: (job: Job<T, R, string>, result: R) => void): void {
    this.worker.on("completed", handler);
  }

  onFailed(handler: (job: Job<T, R, string> | undefined, error: Error) => void): void {
    this.worker.on("failed", handler);
  }

  onProgress(handler: (job: Job<T, R, string>, progress: any) => void): void {
    this.worker.on("progress", handler);
  }

  getConfig(): QueueConfig {
    return this.config;
  }
}
