/**
 * In-memory queue adapter implementation
 */

import type { JobOptions, JobStatus, JobInfo } from "@forge/types";
import type { IQueueAdapter, IEventEmitter } from "../../domain/interfaces";
import type { QueueConfig, QueueOptions } from "../../domain/types";
import { InMemoryEventEmitterAdapter } from "./events.adapter";

/**
 * In-memory job storage
 */
interface InMemoryJob<T = unknown> extends JobInfo<T> {
  status: JobStatus;
}

/**
 * In-memory Queue Adapter
 */
export class InMemoryQueueAdapter implements IQueueAdapter {
  private jobs = new Map<string, InMemoryJob>();
  private jobIdCounter = 0;
  private paused = false;
  private events: InMemoryEventEmitterAdapter;
  private readonly defaultJobOptions: JobOptions;

  constructor(_name: string, _config: QueueConfig, options?: QueueOptions) {
    this.defaultJobOptions = options?.defaultJobOptions ?? {};
    this.events = new InMemoryEventEmitterAdapter();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async add<T>(name: string, data: T, options?: JobOptions): Promise<string> {
    if (this.paused) {
      throw new Error("Queue is paused");
    }

    const jobId = `job:${this.jobIdCounter++}`;
    const now = Date.now();

    const job: InMemoryJob<T> = {
      id: jobId,
      name,
      data,
      opts: { ...this.defaultJobOptions, ...options },
      progress: 0,
      attemptsMade: 0,
      timestamp: now,
      status: "waiting",
    };

    this.jobs.set(jobId, job);
    return jobId;
  }

  async addBulk<T>(jobs: Array<{ name: string; data: T; opts?: JobOptions }>): Promise<string[]> {
    const jobIds: string[] = [];
    for (const job of jobs) {
      const id = await this.add(job.name, job.data, job.opts);
      jobIds.push(id);
    }
    return jobIds;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getJob<T>(jobId: string): Promise<JobInfo<T> | undefined> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return undefined;
    }
    // Deep clone to prevent external modifications from affecting internal state
    return structuredClone(job) as JobInfo<T>;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getJobCounts(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    let waiting = 0;
    let active = 0;
    let completed = 0;
    let failed = 0;
    let delayed = 0;

    for (const job of this.jobs.values()) {
      switch (job.status) {
        case "waiting":
          waiting++;
          break;
        case "active":
          active++;
          break;
        case "completed":
          completed++;
          break;
        case "failed":
          failed++;
          break;
        case "delayed":
          delayed++;
          break;
        case "paused":
          break;
      }
    }

    return { waiting, active, completed, failed, delayed };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getJobs<T>(status: JobStatus, start = 0, end = 10): Promise<JobInfo<T>[]> {
    const filteredJobs = Array.from(this.jobs.values())
      .filter((job) => job.status === status)
      .slice(start, end);

    // Deep clone each job to prevent external modifications
    return filteredJobs.map((job) => structuredClone(job) as JobInfo<T>);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async removeJob(jobId: string): Promise<void> {
    this.jobs.delete(jobId);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async retryJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = "waiting";
      job.attemptsMade = 0;
      job.failedReason = undefined;
      job.stacktrace = undefined;
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async clean(_grace: number, _limit: number, status: "completed" | "failed"): Promise<string[]> {
    const removedIds: string[] = [];
    for (const [id, job] of this.jobs.entries()) {
      if (job.status === status) {
        this.jobs.delete(id);
        removedIds.push(id);
      }
    }
    return removedIds;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async pause(): Promise<void> {
    this.paused = true;
    for (const job of this.jobs.values()) {
      if (job.status === "waiting") {
        job.status = "paused";
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async resume(): Promise<void> {
    this.paused = false;
    for (const job of this.jobs.values()) {
      if (job.status === "paused") {
        job.status = "waiting";
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async isPaused(): Promise<boolean> {
    return this.paused;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async obliterate({ force }: { force?: boolean } = {}): Promise<void> {
    if (force) {
      this.jobs.clear();
    } else {
      const toDelete: string[] = [];
      for (const [id, job] of this.jobs.entries()) {
        if (job.status === "completed" || job.status === "failed") {
          toDelete.push(id);
        }
      }
      for (const id of toDelete) {
        this.jobs.delete(id);
      }
    }
  }

  getEvents(): IEventEmitter {
    return this.events;
  }

  async close(): Promise<void> {
    await this.events.close();
  }

  /**
   * Mark a job as active (for testing purposes)
   * @internal
   */
  markJobActive(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = "active";
      job.processedOn = Date.now();
    }
  }

  /**
   * Mark a job as completed (for testing purposes)
   * @internal
   */
  markJobCompleted<T>(jobId: string, result?: T): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = "completed";
      job.finishedOn = Date.now();
      job.returnvalue = result;
    }
  }

  /**
   * Mark a job as failed (for testing purposes)
   * @internal
   */
  markJobFailed(jobId: string, error: Error): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = "failed";
      job.finishedOn = Date.now();
      job.failedReason = error.message;
    }
  }
}
