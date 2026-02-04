import { Queue, Worker, QueueEvents } from "bullmq";
import Redis from "ioredis";

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export interface QueueConfig {
  redis: RedisConfig;
}

let redisConnection: Redis | undefined;

/**
 * Get or create a Redis connection for queue operations.
 * Uses BullMQ-compatible settings (maxRetriesPerRequest: null).
 *
 * @param config - Redis connection configuration
 * @returns Redis connection instance
 */
export function getRedisConnection(config: RedisConfig): Redis {
  if (!redisConnection) {
    redisConnection = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db || 0,
      // BullMQ requires maxRetriesPerRequest to be null
      // This allows BullMQ to handle its own retry logic
      maxRetriesPerRequest: null,
    });

    redisConnection.on("error", (error) => {
      console.error("Redis connection error:", error);
    });

    redisConnection.on("connect", () => {
      console.log("Redis connected");
    });
  }

  return redisConnection;
}

/**
 * Close the Redis connection gracefully.
 * Should be called during application shutdown.
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisConnection) {
    try {
      await redisConnection.quit();
    } catch (error) {
      if ((error as Error).message?.includes("Connection is closed")) {
        return;
      }
      throw error;
    } finally {
      redisConnection = undefined;
    }
  }
}

/**
 * Create a BullMQ queue for job processing.
 *
 * @param name - Queue name identifier
 * @param config - Queue configuration including Redis settings
 * @returns BullMQ Queue instance
 */
export function createQueue<T = any>(name: string, config: QueueConfig): Queue<T> {
  const connection = getRedisConnection(config.redis);

  return new Queue<T>(name, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: {
        count: 100,
        age: 24 * 3600,
      },
      removeOnFail: {
        count: 1000,
      },
    },
  });
}

/**
 * Create a BullMQ worker to process jobs from a queue.
 *
 * @param name - Queue name to listen to
 * @param processor - Async function to process each job
 * @param config - Queue configuration including Redis settings
 * @returns BullMQ Worker instance
 */
export function createWorker<T = any>(
  name: string,
  processor: (job: any) => Promise<any>,
  config: QueueConfig
): Worker<T> {
  const connection = getRedisConnection(config.redis);

  return new Worker<T>(name, processor, {
    connection,
    concurrency: 5,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 1000 },
  });
}

/**
 * Create a QueueEvents listener for monitoring queue events.
 *
 * @param name - Queue name to listen to
 * @param config - Queue configuration including Redis settings
 * @returns BullMQ QueueEvents instance
 */
export function createQueueEvents(name: string, config: QueueConfig): QueueEvents {
  const connection = getRedisConnection(config.redis);

  return new QueueEvents(name, {
    connection,
  });
}
