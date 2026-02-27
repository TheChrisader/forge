/**
 * In-memory adapter tests
 */

import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { InMemoryQueueAdapter } from "../adapters/memory/queue.adapter";
import { InMemoryWorkerAdapter } from "../adapters/memory/worker.adapter";
import { InMemoryEventEmitterAdapter } from "../adapters/memory/events.adapter";
import type { QueueConfig, WorkerOptions } from "../domain/types";
import type { JobOptions } from "@forge/types";
import { createTestMemoryConfig } from "./helpers";

describe("InMemoryQueueAdapter", () => {
  let queue: InMemoryQueueAdapter;
  let config: QueueConfig;

  beforeEach(() => {
    config = createTestMemoryConfig();
    queue = new InMemoryQueueAdapter("test-queue", config);
  });

  afterEach(async () => {
    await queue.close();
  });

  describe("addJob", () => {
    it("should add a job and return job ID", async () => {
      const jobId = await queue.add("test-job", { foo: "bar" });

      expect(jobId).toMatch(/^job:\d+$/);
    });

    it("should add job with options", async () => {
      const options: JobOptions = {
        attempts: 5,
        priority: 10,
      };

      const jobId = await queue.add("test-job", { data: "test" }, options);

      const job = await queue.getJob(jobId);
      expect(job).toBeDefined();
      expect(job?.opts.attempts).toBe(5);
      expect(job?.opts.priority).toBe(10);
    });

    it("should throw error when adding to paused queue", async () => {
      await queue.pause();

      await expect(queue.add("test-job", { data: "test" })).rejects.toThrow("Queue is paused");
    });
  });

  describe("addBulk", () => {
    it("should add multiple jobs", async () => {
      const jobs = [
        { name: "job1", data: { id: 1 } },
        { name: "job2", data: { id: 2 } },
        { name: "job3", data: { id: 3 } },
      ];

      const jobIds = await queue.addBulk(jobs);

      expect(jobIds).toHaveLength(3);
      expect(jobIds[0]).toMatch(/^job:\d+$/);
    });
  });

  describe("getJob", () => {
    it("should return job by ID", async () => {
      const jobId = await queue.add("test-job", { foo: "bar" });

      const job = await queue.getJob<{ foo: string }>(jobId);

      expect(job).toBeDefined();
      expect(job?.id).toBe(jobId);
      expect(job?.name).toBe("test-job");
      expect(job?.data).toEqual({ foo: "bar" });
    });

    it("should return undefined for non-existent job", async () => {
      const job = await queue.getJob("non-existent");

      expect(job).toBeUndefined();
    });

    it("should return a copy of the job data", async () => {
      const jobId = await queue.add("test-job", { foo: "bar" });
      const job1 = await queue.getJob<{ foo: string }>(jobId);
      const job2 = await queue.getJob<{ foo: string }>(jobId);

      // Modifying one shouldn't affect the other
      if (job1) {
        job1.data.foo = "modified";
      }

      expect(job2?.data.foo).toBe("bar");
    });
  });

  describe("getJobCounts", () => {
    it("should return zero counts for empty queue", async () => {
      const counts = await queue.getJobCounts();

      expect(counts).toEqual({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      });
    });

    it("should count jobs by status", async () => {
      await queue.add("job1", { data: 1 });
      await queue.add("job2", { data: 2 });
      await queue.add("job3", { data: 3 });

      const counts = await queue.getJobCounts();

      expect(counts.waiting).toBe(3);
    });
  });

  describe("getJobs", () => {
    it("should return jobs by status", async () => {
      await queue.add("job1", { data: 1 });
      await queue.add("job2", { data: 2 });

      const jobs = await queue.getJobs("waiting");

      expect(jobs).toHaveLength(2);
      expect(jobs[0].name).toBe("job1");
      expect(jobs[1].name).toBe("job2");
    });

    it("should support pagination", async () => {
      await queue.add("job1", { data: 1 });
      await queue.add("job2", { data: 2 });
      await queue.add("job3", { data: 3 });

      const jobs = await queue.getJobs("waiting", 0, 2);

      expect(jobs).toHaveLength(2);
    });
  });

  describe("removeJob", () => {
    it("should remove a job from the queue", async () => {
      const jobId = await queue.add("test-job", { data: "test" });

      await queue.removeJob(jobId);

      const job = await queue.getJob(jobId);
      expect(job).toBeUndefined();
    });

    it("should not throw when removing non-existent job", async () => {
      await expect(queue.removeJob("non-existent")).resolves.not.toThrow();
    });
  });

  describe("retryJob", () => {
    it("should reset job status to waiting", async () => {
      const jobId = await queue.add("test-job", { data: "test" });

      // Mark job as failed using internal method
      queue.markJobFailed(jobId, new Error("Test error"));

      const jobBefore = await queue.getJob(jobId);
      expect(jobBefore?.failedReason).toBe("Test error");

      await queue.retryJob(jobId);

      // Cast to access internal status property
      const jobAfter = (await queue.getJob(jobId)) as
        | { id: string; status?: string; failedReason?: string }
        | undefined;
      expect(jobAfter?.status).toBe("waiting");
      expect(jobAfter?.failedReason).toBeUndefined();
    });
  });

  describe("clean", () => {
    it("should remove completed jobs", async () => {
      const jobId1 = await queue.add("job1", { data: 1 });
      const jobId2 = await queue.add("job2", { data: 2 });

      // Mark both jobs as completed using internal method
      queue.markJobCompleted(jobId1, { result: "test1" });
      queue.markJobCompleted(jobId2, { result: "test2" });

      const removed = await queue.clean(0, 100, "completed");

      expect(removed.length).toBe(2);
    });
  });

  describe("pause/resume", () => {
    it("should pause the queue", async () => {
      await queue.pause();

      expect(await queue.isPaused()).toBe(true);
    });

    it("should resume the queue", async () => {
      await queue.pause();
      await queue.resume();

      expect(await queue.isPaused()).toBe(false);
    });

    it("should move waiting jobs to paused when paused", async () => {
      await queue.add("job1", { data: 1 });
      await queue.add("job2", { data: 2 });

      await queue.pause();

      const jobs = await queue.getJobs("paused");
      expect(jobs).toHaveLength(2);
    });

    it("should move paused jobs back to waiting when resumed", async () => {
      await queue.add("job1", { data: 1 });
      await queue.pause();
      await queue.resume();

      const jobs = await queue.getJobs("waiting");
      expect(jobs).toHaveLength(1);
    });
  });

  describe("obliterate", () => {
    it("should remove all completed and failed jobs", async () => {
      const jobId1 = await queue.add("job1", { data: 1 });
      const jobId2 = await queue.add("job2", { data: 2 });

      // Mark jobs as completed using job IDs
      queue.markJobCompleted(jobId1, {});
      queue.markJobCompleted(jobId2, {});

      await queue.obliterate();

      const counts = await queue.getJobCounts();
      expect(counts.completed).toBe(0);
      expect(counts.failed).toBe(0);
    });

    it("should remove all jobs when force is true", async () => {
      await queue.add("job1", { data: 1 });
      await queue.add("job2", { data: 2 });

      await queue.obliterate({ force: true });

      const counts = await queue.getJobCounts();
      expect(counts.waiting).toBe(0);
    });
  });

  describe("getEvents", () => {
    it("should return event emitter", () => {
      const events = queue.getEvents();

      expect(events).toBeInstanceOf(InMemoryEventEmitterAdapter);
    });
  });
});

describe("InMemoryWorkerAdapter", () => {
  let worker: InMemoryWorkerAdapter;
  let config: QueueConfig;

  beforeEach(() => {
    config = createTestMemoryConfig();
    worker = new InMemoryWorkerAdapter(
      "test-worker",
      // eslint-disable-next-line @typescript-eslint/require-await
      async (job) => ({ success: true, jobId: job.id }),
      config
    );
  });

  afterEach(async () => {
    await worker.close();
  });

  describe("constructor", () => {
    it("should create a worker with processor", () => {
      expect(worker.isRunning()).toBe(true);
      expect(worker.isPaused()).toBe(false);
    });

    it("should accept worker options", () => {
      const options: WorkerOptions = {
        concurrency: 10,
        limiter: { max: 100, duration: 60000 },
      };

      const workerWithOptions = new InMemoryWorkerAdapter(
        "test-worker",
        // eslint-disable-next-line @typescript-eslint/require-await
        async () => ({}),
        config,
        options
      );

      expect(workerWithOptions).toBeDefined();
    });
  });

  describe("pause/resume", () => {
    it("should pause the worker", async () => {
      await worker.pause();

      expect(worker.isPaused()).toBe(true);
    });

    it("should resume the worker", async () => {
      await worker.pause();
      await worker.resume();

      expect(worker.isPaused()).toBe(false);
    });
  });

  describe("close", () => {
    it("should stop the worker", async () => {
      expect(worker.isRunning()).toBe(true);

      await worker.close();

      expect(worker.isRunning()).toBe(false);
    });
  });

  describe("event handlers", () => {
    it("should register onCompleted handler", async () => {
      const handler = vi.fn();
      worker.onCompleted(handler);

      const testJob: import("@forge/types").JobInfo = {
        id: "job1",
        name: "test",
        data: {},
        opts: {},
        progress: 0,
        attemptsMade: 0,
        timestamp: Date.now(),
      };

      await worker.processJob(testJob);

      // Give time for async handlers to execute
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalled();
    });

    it("should register onFailed handler", async () => {
      const handler = vi.fn();
      worker.onFailed(handler);

      const processor = vi.fn().mockRejectedValue(new Error("Test error"));
      const errorWorker = new InMemoryWorkerAdapter("test", processor, config);
      errorWorker.onFailed(handler);

      const testJob: import("@forge/types").JobInfo = {
        id: "job1",
        name: "test",
        data: {},
        opts: {},
        progress: 0,
        attemptsMade: 0,
        timestamp: Date.now(),
      };

      await errorWorker.processJob(testJob);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalled();
      await errorWorker.close();
    });

    it("should register onProgress handler", async () => {
      const handler = vi.fn();
      worker.onProgress(handler);

      const testJob: import("@forge/types").JobInfo = {
        id: "job1",
        name: "test",
        data: {},
        opts: {},
        progress: 0,
        attemptsMade: 0,
        timestamp: Date.now(),
      };

      await worker.emitProgress(testJob, 50);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith(expect.anything(), 50);
    });
  });
});

describe("InMemoryEventEmitterAdapter", () => {
  let events: InMemoryEventEmitterAdapter;

  beforeEach(() => {
    events = new InMemoryEventEmitterAdapter();
  });

  afterEach(async () => {
    await events.close();
  });

  describe("event handlers", () => {
    it("should register and emit progress events", () => {
      const handler = vi.fn();
      events.onProgress(handler);

      events.emitProgress("job1", 50);

      expect(handler).toHaveBeenCalledWith("job1", 50);
    });

    it("should register and emit completed events", () => {
      const handler = vi.fn();
      events.onCompleted(handler);

      events.emitCompleted("job1", { result: "test" });

      expect(handler).toHaveBeenCalledWith("job1", { result: "test" });
    });

    it("should register and emit failed events", () => {
      const handler = vi.fn();
      events.onFailed(handler);

      const error = new Error("Test error");
      events.emitFailed("job1", error);

      expect(handler).toHaveBeenCalledWith("job1", error);
    });

    it("should call all handlers of the same type", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      events.onCompleted(handler1);
      events.onCompleted(handler2);

      events.emitCompleted("job1", {});

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it("should remove all listeners", () => {
      const handler = vi.fn();
      events.onCompleted(handler);

      events.removeAllListeners();
      events.emitCompleted("job1", {});

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("close", () => {
    it("should clear all handlers on close", async () => {
      const handler = vi.fn();
      events.onCompleted(handler);

      await events.close();
      events.emitCompleted("job1", {});

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
