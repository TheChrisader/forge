/**
 * Domain interfaces for the queue package
 */

import type { JobOptions, JobStatus, JobInfo } from "@forge/types";
import type { BulkJob, WorkerOptions, QueueOptions, QueueConfig } from "./types";

/**
 * Job context provided to job processors
 * Provides readonly job data and ability to emit progress updates
 */
export interface IJobContext<T> {
  /** Readonly job information */
  readonly job: JobInfo<T>;

  /** Emit a progress update - accepts either a percentage number or an arbitrary object */
  updateProgress(progress: number | Record<string, unknown>): Promise<void>;
}

/**
 * Queue adapter interface
 */
export interface IQueueAdapter {
  /**
   * Add a single job to the queue
   * @returns The job ID
   */
  add<T>(name: string, data: T, options?: JobOptions): Promise<string>;

  /**
   * Add multiple jobs to the queue in bulk
   * @returns Array of job IDs
   */
  addBulk<T>(jobs: BulkJob<T>[]): Promise<string[]>;

  /**
   * Get a job by its ID
   */
  getJob<T>(jobId: string): Promise<JobInfo<T> | undefined>;

  /**
   * Get job counts by status
   */
  getJobCounts(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }>;

  /**
   * Get jobs by status
   */
  getJobs<T>(status: JobStatus, start?: number, end?: number): Promise<JobInfo<T>[]>;

  /**
   * Remove a job from the queue
   */
  removeJob(jobId: string): Promise<void>;

  /**
   * Retry a failed job
   */
  retryJob(jobId: string): Promise<void>;

  /**
   * Clean old jobs from the queue
   */
  clean(grace: number, limit: number, status: "completed" | "failed"): Promise<string[]>;

  /**
   * Pause the queue
   */
  pause(): Promise<void>;

  /**
   * Resume the queue
   */
  resume(): Promise<void>;

  /**
   * Check if the queue is paused
   */
  isPaused(): Promise<boolean>;

  /**
   * Obliterate the queue (remove all jobs)
   */
  obliterate(options?: { force: boolean }): Promise<void>;

  /**
   * Close the queue and release resources
   */
  close(): Promise<void>;

  /**
   * Get the event emitter for this queue
   */
  getEvents(): IEventEmitter;
}

/**
 * Worker adapter interface
 */
export interface IWorkerAdapter {
  /**
   * Pause the worker
   */
  pause(): Promise<void>;

  /**
   * Resume the worker
   */
  resume(): Promise<void>;

  /**
   * Close the worker and release resources
   */
  close(): Promise<void>;

  /**
   * Check if the worker is running
   */
  isRunning(): boolean;

  /**
   * Check if the worker is paused
   */
  isPaused(): boolean;

  /**
   * Register a handler for job completion events
   */
  onCompleted<T, R>(handler: (job: JobInfo<T>, result: R) => void | Promise<void>): void;

  /**
   * Register a handler for job failure events
   */
  onFailed<T>(handler: (job: JobInfo<T> | undefined, error: Error) => void | Promise<void>): void;

  /**
   * Register a handler for job progress events
   */
  onProgress<T>(
    handler: (job: JobInfo<T>, progress: number | object) => void | Promise<void>
  ): void;
}

/**
 * Event emitter interface
 */
export interface IEventEmitter {
  /**
   * Register a handler for progress events
   */
  onProgress(handler: (...args: unknown[]) => void): void;

  /**
   * Register a handler for completed events
   */
  onCompleted(handler: (...args: unknown[]) => void): void;

  /**
   * Register a handler for failed events
   */
  onFailed(handler: (...args: unknown[]) => void): void;

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void;

  /**
   * Close the event emitter
   */
  close(): Promise<void>;
}

/**
 * Queue adapter factory interface
 */
export interface IQueueAdapterFactory {
  /**
   * Create a queue adapter
   */
  createQueue(name: string, config: QueueConfig, options?: QueueOptions): IQueueAdapter;

  /**
   * Create a worker adapter
   */
  createWorker<T, R>(
    name: string,
    processor: (context: IJobContext<T>) => Promise<R>,
    config: QueueConfig,
    options?: WorkerOptions
  ): IWorkerAdapter;
}
