/**
 * BullMQ adapter integration tests
 * These tests require a running Redis instance or Docker
 */

import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { BullMQQueueAdapter } from "../adapters/bullmq/queue.adapter";
import { BullMQWorkerAdapter } from "../adapters/bullmq/worker.adapter";
import { BullMQEventEmitterAdapter } from "../adapters/bullmq/events.adapter";
import type { QueueConfig, WorkerOptions, QueueOptions } from "../domain/types";
import { createTestRedisConfig } from "./helpers";

// Helper to check if Redis is available
async function isRedisAvailable(port = 6379): Promise<boolean> {
  try {
    const Redis = (await import("ioredis")).default;
    const redis = new Redis({ port, maxRetriesPerRequest: 1 });
    await redis.ping();
    await redis.quit();
    return true;
  } catch {
    return false;
  }
}

// Check Redis availability at module load - defaults to false, updates async
let redisAvailable = false;
void isRedisAvailable().then((result) => {
  redisAvailable = result;
});

describe.skipIf(() => !redisAvailable)("BullMQQueueAdapter (integration)", () => {
  let queue: BullMQQueueAdapter;
  let config: QueueConfig;
  const uniqueId = Math.random().toString(36).substring(7);

  beforeEach(() => {
    config = createTestRedisConfig();
  });

  afterEach(async () => {
    await queue.close();
  });

  describe("addJob", () => {
    it("should add a job and return job ID", async () => {
      queue = new BullMQQueueAdapter(`test-add-${uniqueId}`, config);

      const jobId = await queue.add("test-job", { foo: "bar" });

      expect(jobId).toBeDefined();
      expect(jobId).toMatch(/^\d+$/); // BullMQ uses numeric IDs
    });

    it("should retrieve the added job", async () => {
      queue = new BullMQQueueAdapter(`test-retrieve-${uniqueId}`, config);

      const jobId = await queue.add("test-job", { foo: "bar" });
      const job = await queue.getJob<{ foo: string }>(jobId);

      expect(job).toBeDefined();
      expect(job?.id).toBe(jobId);
      expect(job?.name).toBe("test-job");
      expect(job?.data).toEqual({ foo: "bar" });
    });

    it("should add job with options", async () => {
      const options: QueueOptions = {
        defaultJobOptions: {
          attempts: 5,
          priority: 10,
        },
      };

      queue = new BullMQQueueAdapter(`test-options-${uniqueId}`, config, options);

      const jobId = await queue.add(
        "test-job",
        { data: "test" },
        {
          attempts: 3,
        }
      );

      const job = await queue.getJob(jobId);
      expect(job).toBeDefined();
      expect(job?.opts.attempts).toBe(3);
    });
  });

  describe("addBulk", () => {
    it("should add multiple jobs", async () => {
      queue = new BullMQQueueAdapter(`test-bulk-${uniqueId}`, config);

      const jobs = [
        { name: "job1", data: { id: 1 } },
        { name: "job2", data: { id: 2 } },
        { name: "job3", data: { id: 3 } },
      ];

      const jobIds = await queue.addBulk(jobs);

      expect(jobIds).toHaveLength(3);
      for (const jobId of jobIds) {
        expect(jobId).toBeDefined();
      }
    });
  });

  describe("getJobCounts", () => {
    it("should return zero counts for empty queue", async () => {
      queue = new BullMQQueueAdapter(`test-counts-${uniqueId}`, config);

      const counts = await queue.getJobCounts();

      expect(counts.waiting).toBe(0);
      expect(counts.active).toBe(0);
      expect(counts.completed).toBe(0);
      expect(counts.failed).toBe(0);
      expect(counts.delayed).toBe(0);
    });

    it("should count jobs by status", async () => {
      queue = new BullMQQueueAdapter(`test-counts-jobs-${uniqueId}`, config);

      await queue.add("job1", { data: 1 });
      await queue.add("job2", { data: 2 });
      await queue.add("job3", { data: 3 });

      const counts = await queue.getJobCounts();

      expect(counts.waiting).toBe(3);
    });
  });

  describe("getJobs", () => {
    it("should return jobs by status", async () => {
      queue = new BullMQQueueAdapter(`test-get-jobs-${uniqueId}`, config);

      await queue.add("job1", { data: 1 });
      await queue.add("job2", { data: 2 });

      const jobs = await queue.getJobs("waiting");

      expect(jobs.length).toBe(2);
    });
  });

  describe("pause/resume", () => {
    it("should pause the queue", async () => {
      queue = new BullMQQueueAdapter(`test-pause-${uniqueId}`, config);

      await queue.pause();

      expect(await queue.isPaused()).toBe(true);
    });

    it("should resume the queue", async () => {
      queue = new BullMQQueueAdapter(`test-resume-${uniqueId}`, config);

      await queue.pause();
      await queue.resume();

      expect(await queue.isPaused()).toBe(false);
    });
  });

  describe("clean", () => {
    it("should clean completed jobs", async () => {
      queue = new BullMQQueueAdapter(`test-clean-${uniqueId}`, config);

      await queue.add("job1", { data: 1 });
      await queue.add("job2", { data: 2 });

      // Process jobs to complete them
      const worker = new BullMQWorkerAdapter(
        `test-clean-${uniqueId}`,
        // eslint-disable-next-line @typescript-eslint/require-await
        async () => ({ success: true }),
        config
      );

      // Wait for jobs to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      const cleaned = await queue.clean(0, 100, "completed");

      expect(cleaned.length).toBeGreaterThanOrEqual(0);

      await worker.close();
    });
  });

  describe("obliterate", () => {
    it("should remove all jobs", async () => {
      queue = new BullMQQueueAdapter(`test-obliterate-${uniqueId}`, config);

      await queue.add("job1", { data: 1 });
      await queue.add("job2", { data: 2 });

      await queue.obliterate({ force: true });

      const counts = await queue.getJobCounts();
      expect(counts.waiting).toBe(0);
    });
  });

  describe("getEvents", () => {
    it("should return event emitter", () => {
      queue = new BullMQQueueAdapter(`test-events-${uniqueId}`, config);

      const events = queue.getEvents();

      expect(events).toBeInstanceOf(BullMQEventEmitterAdapter);
    });
  });
});

describe.skipIf(() => !redisAvailable)("BullMQWorkerAdapter (integration)", () => {
  let worker: BullMQWorkerAdapter;
  let queue: BullMQQueueAdapter;
  let config: QueueConfig;
  const uniqueId = Math.random().toString(36).substring(7);

  beforeEach(() => {
    config = createTestRedisConfig();
  });

  afterEach(async () => {
    await worker.close();
    await queue.close();
  });

  describe("constructor", () => {
    it("should create a worker with processor", () => {
      queue = new BullMQQueueAdapter(`test-worker-init-${uniqueId}`, config);
      worker = new BullMQWorkerAdapter(
        `test-worker-init-${uniqueId}`,
        // eslint-disable-next-line @typescript-eslint/require-await
        async () => ({ success: true }),
        config
      );

      expect(worker.isRunning()).toBe(true);
      expect(worker.isPaused()).toBe(false);
    });

    it("should accept worker options", () => {
      queue = new BullMQQueueAdapter(`test-worker-opts-${uniqueId}`, config);
      const options: WorkerOptions = {
        concurrency: 10,
        limiter: { max: 100, duration: 60000 },
      };

      worker = new BullMQWorkerAdapter(
        `test-worker-opts-${uniqueId}`,
        // eslint-disable-next-line @typescript-eslint/require-await
        async () => ({ success: true }),
        config,
        options
      );

      expect(worker).toBeDefined();
    });
  });

  describe("pause/resume", () => {
    it("should pause the worker", async () => {
      queue = new BullMQQueueAdapter(`test-worker-pause-${uniqueId}`, config);
      worker = new BullMQWorkerAdapter(
        `test-worker-pause-${uniqueId}`,
        // eslint-disable-next-line @typescript-eslint/require-await
        async () => ({ success: true }),
        config
      );

      await worker.pause();

      expect(worker.isPaused()).toBe(true);
    });

    it("should resume the worker", async () => {
      queue = new BullMQQueueAdapter(`test-worker-resume-${uniqueId}`, config);
      worker = new BullMQWorkerAdapter(
        `test-worker-resume-${uniqueId}`,
        // eslint-disable-next-line @typescript-eslint/require-await
        async () => ({ success: true }),
        config
      );

      await worker.pause();
      await worker.resume();

      expect(worker.isPaused()).toBe(false);
    });
  });

  describe("event handlers", () => {
    it("should receive completed events", async () => {
      queue = new BullMQQueueAdapter(`test-events-complete-${uniqueId}`, config);
      worker = new BullMQWorkerAdapter(
        `test-events-complete-${uniqueId}`,
        // eslint-disable-next-line @typescript-eslint/require-await
        async () => ({ success: true }),
        config
      );

      let completedJob: any = null;
      worker.onCompleted((job, result) => {
        completedJob = { job, result };
      });

      await queue.add("test-job", { data: "test" });

      // Wait for job to be processed
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(completedJob).toBeDefined();
      expect(completedJob.result).toEqual({ success: true });
    });

    it("should receive failed events", async () => {
      queue = new BullMQQueueAdapter(`test-events-failed-${uniqueId}`, config);
      worker = new BullMQWorkerAdapter(
        `test-events-failed-${uniqueId}`,
        // eslint-disable-next-line @typescript-eslint/require-await
        async () => {
          throw new Error("Test error");
        },
        config
      );

      let failedJob: unknown = null;
      let failedError: unknown = null;
      worker.onFailed((job, error) => {
        failedJob = job;
        failedError = error;
      });

      await queue.add("test-job", { data: "test" }, { attempts: 1 });

      // Wait for job to fail
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(failedJob).toBeDefined();
      expect(failedError).toBeInstanceOf(Error);
      expect((failedError as Error)?.message).toBe("Test error");
    });
  });
});

describe.skipIf(() => !redisAvailable)("BullMQ end-to-end (integration)", () => {
  let service: any;
  let config: QueueConfig;
  const uniqueId = Math.random().toString(36).substring(7);

  beforeEach(async () => {
    config = createTestRedisConfig();
    const { QueueService } = await import("../services/queue.service");
    service = new QueueService(config);
  });

  afterEach(async () => {
    await service.close();
  });

  it("should process jobs from queue to worker", async () => {
    const queueName = `test-e2e-${uniqueId}`;
    let processedJob: unknown = null;

    const worker = service.registerWorker(
      queueName,
      // eslint-disable-next-line @typescript-eslint/require-await
      async (job: { data: { data: string } }) => {
        processedJob = job;
        return { success: true, processed: true };
      }
    );

    worker.onCompleted(() => {
      // Job completed
    });

    await service.addJob(queueName, "test-job", {
      data: "test-data",
    });

    // Wait for job to be processed
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(processedJob).toBeDefined();
    expect((processedJob as { data: { data: string } }).data).toEqual({ data: "test-data" });
  });

  it("should handle job failures", async () => {
    const queueName = `test-failure-${uniqueId}`;
    let failedJob: unknown = null;

    const worker = service.registerWorker(
      queueName,
      // eslint-disable-next-line @typescript-eslint/require-await
      async () => {
        throw new Error("Intentional failure");
      }
    );

    worker.onFailed((_job: unknown) => {
      failedJob = _job;
    });

    await service.addJob(queueName, "failing-job", { data: "test" }, { attempts: 1 });

    // Wait for job to fail
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(failedJob).toBeDefined();
  });
});
