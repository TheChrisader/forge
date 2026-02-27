/**
 * Domain types for the queue package
 */

import type { JobOptions, BackoffOptions, JobStatus, JobInfo } from "@forge/types";
export type { JobOptions, BackoffOptions, JobStatus, JobInfo };

/**
 * Queue connection configuration
 */
export interface QueueConnectionConfig {
  type: "redis" | "memory";
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  connection: QueueConnectionConfig;
  defaultJobOptions?: JobOptions;
}

/**
 * Redis configuration (legacy format for backward compatibility)
 * @deprecated Use QueueConnectionConfig with type: 'redis' instead
 */
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export interface QueueHealth {
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

export interface BulkJob<T> {
  name: string;
  data: T;
  opts?: JobOptions;
}
