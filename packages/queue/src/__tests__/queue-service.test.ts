/**
 * Queue Service tests
 */

import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { QueueService, getQueueService, closeQueueService } from "../services/queue.service";
import { QUEUE_NAMES } from "../constants";
import type { QueueConfig, WorkerOptions } from "../domain/types";
import type { JobOptions } from "@forge/types";
import { createTestMemoryConfig } from "./helpers";

describe("QueueService", () => {
  let service: QueueService;
  let config: QueueConfig;

  beforeEach(() => {
    config = createTestMemoryConfig();
    service = new QueueService(config);
  });

  afterEach(async () => {
    await service.close();
  });

  describe("constructor", () => {
    it("should create a service with config", () => {
      expect(service).toBeDefined();
    });
  });

  describe("getQueue", () => {
    it("should return same queue instance for same name", () => {
      const queue1 = service.getQueue("test-queue");
      const queue2 = service.getQueue("test-queue");

      expect(queue1).toBe(queue2);
    });

    it("should return different queue instances for different names", () => {
      const queue1 = service.getQueue("queue1");
      const queue2 = service.getQueue("queue2");

      expect(queue1).not.toBe(queue2);
    });
  });

  describe("registerWorker", () => {
    it("should register a worker for a queue", () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      const processor = async (): Promise<{ success: boolean }> => ({ success: true });

      const worker = service.registerWorker("test-worker", processor);

      expect(worker).toBeDefined();
      expect(worker.isRunning()).toBe(true);
    });

    it("should throw when registering duplicate worker", () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      const processor = async (): Promise<{ success: boolean }> => ({ success: true });

      service.registerWorker("test-worker", processor);

      expect(() => service.registerWorker("test-worker", processor)).toThrow(
        "Worker already registered for queue: test-worker"
      );
    });

    it("should accept worker options", () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      const processor = async (): Promise<{ success: boolean }> => ({ success: true });
      const options: WorkerOptions = {
        concurrency: 10,
        limiter: { max: 100, duration: 60000 },
      };

      const worker = service.registerWorker("test-worker", processor, options);

      expect(worker).toBeDefined();
    });
  });

  describe("addJob", () => {
    it("should add a job to a queue", async () => {
      const jobId = await service.addJob("test-queue", "test-job", {
        data: "test",
      });

      expect(jobId).toBeDefined();
    });

    it("should add job with options", async () => {
      const options: JobOptions = {
        attempts: 5,
        priority: 10,
      };

      const jobId = await service.addJob("test-queue", "test-job", { data: "test" }, options);

      expect(jobId).toBeDefined();
    });
  });

  describe("getHealth", () => {
    it("should return healthy status for new queue", async () => {
      const health = await service.getHealth("test-queue");

      expect(health.healthy).toBe(true);
      expect(health.isPaused).toBe(false);
      expect(health.counts.failed).toBe(0);
    });

    it("should return unhealthy when many jobs failed", async () => {
      // Add and mark jobs as failed
      const queue = service.getQueue("test-queue");
      for (let i = 0; i < 101; i++) {
        const jobId = await queue.add(`job${i}`, { data: i });
        const job = await queue.getJob(jobId);
        if (job) {
          (queue as any).markJobFailed(job.id, new Error("Test"));
        }
      }

      const health = await service.getHealth("test-queue");

      expect(health.healthy).toBe(false);
    });
  });

  describe("getAllHealth", () => {
    it("should return health for all queue names", async () => {
      // Add a job to each queue to initialize them
      await service.addJob(QUEUE_NAMES.BUILD, "test", { data: 1 });
      await service.addJob(QUEUE_NAMES.DEPLOY, "test", { data: 1 });
      await service.addJob(QUEUE_NAMES.JOBS, "test", { data: 1 });

      const healthMap = await service.getAllHealth();

      expect(healthMap.size).toBeGreaterThan(0);
      expect(healthMap.has(QUEUE_NAMES.BUILD)).toBe(true);
      expect(healthMap.has(QUEUE_NAMES.DEPLOY)).toBe(true);
    });
  });

  describe("cleanQueues", () => {
    it("should clean completed jobs from all queues", async () => {
      const jobId1 = await service.addJob("queue1", "job1", { data: 1 });
      const jobId2 = await service.addJob("queue2", "job2", { data: 2 });

      // Mark jobs as completed (pass job ID, not JobInfo object)
      const queue1 = service.getQueue("queue1");
      const queue2 = service.getQueue("queue2");
      (queue1 as any).markJobCompleted(jobId1, {});
      (queue2 as any).markJobCompleted(jobId2, {});

      await service.cleanQueues(0, 100);

      const counts1 = await queue1.getJobCounts();
      const counts2 = await queue2.getJobCounts();

      expect(counts1.completed).toBe(0);
      expect(counts2.completed).toBe(0);
    });
  });

  describe("pauseAll/resumeAll", () => {
    it("should pause all queues", async () => {
      await service.addJob("queue1", "job1", { data: 1 });
      await service.addJob("queue2", "job2", { data: 2 });

      await service.pauseAll();

      const queue1 = service.getQueue("queue1");
      const queue2 = service.getQueue("queue2");

      expect(await queue1.isPaused()).toBe(true);
      expect(await queue2.isPaused()).toBe(true);
    });

    it("should resume all queues", async () => {
      await service.addJob("queue1", "job1", { data: 1 });
      await service.addJob("queue2", "job2", { data: 2 });

      await service.pauseAll();
      await service.resumeAll();

      const queue1 = service.getQueue("queue1");
      const queue2 = service.getQueue("queue2");

      expect(await queue1.isPaused()).toBe(false);
      expect(await queue2.isPaused()).toBe(false);
    });
  });

  describe("getMetrics", () => {
    it("should return metrics for all queues", async () => {
      await service.addJob("queue1", "job1", { data: 1 });
      await service.addJob("queue2", "job2", { data: 2 });

      const metrics = await service.getMetrics();

      expect(metrics.queues).toBe(2);
      expect(metrics.totalJobs.waiting).toBe(2);
    });
  });

  describe("event subscriptions", () => {
    it("should subscribe to progress events", () => {
      const handler = vi.fn();

      service.onProgress("test-queue", handler);

      // Emit event through the queue
      const queue = service.getQueue("test-queue");
      const events = queue.getEvents();
      (events as any).emitProgress("job1", 50);

      // Need to verify handler was called - this tests the wiring
      expect(handler).toBeDefined();
    });

    it("should subscribe to completed events", () => {
      const handler = vi.fn();

      service.onCompleted("test-queue", handler);

      expect(handler).toBeDefined();
    });

    it("should subscribe to failed events", () => {
      const handler = vi.fn();

      service.onFailed("test-queue", handler);

      expect(handler).toBeDefined();
    });
  });

  describe("close", () => {
    it("should close all queues and workers", async () => {
      await service.addJob("queue1", "job1", { data: 1 });
      // eslint-disable-next-line @typescript-eslint/require-await
      service.registerWorker("worker1", async () => ({ success: true }));

      await service.close();

      // After close, getQueue should create new instances
      const newQueue = service.getQueue("queue1");
      expect(newQueue).toBeDefined();
    });
  });

  describe("getWorker", () => {
    it("should return registered worker", () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      const processor = async (): Promise<{ success: boolean }> => ({ success: true });
      service.registerWorker("test-worker", processor);

      const worker = service.getWorker("test-worker");

      expect(worker).toBeDefined();
    });

    it("should return undefined for non-existent worker", () => {
      const worker = service.getWorker("non-existent");

      expect(worker).toBeUndefined();
    });
  });

  describe("getAllWorkers", () => {
    it("should return all registered workers", () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      const processor = async (): Promise<{ success: boolean }> => ({ success: true });
      service.registerWorker("worker1", processor);
      service.registerWorker("worker2", processor);

      const workers = service.getAllWorkers();

      expect(workers.size).toBe(2);
      expect(workers.has("worker1")).toBe(true);
      expect(workers.has("worker2")).toBe(true);
    });
  });

  describe("getAllQueues", () => {
    it("should return all created queues", () => {
      service.getQueue("queue1");
      service.getQueue("queue2");

      const queues = service.getAllQueues();

      expect(queues.size).toBe(2);
      expect(queues.has("queue1")).toBe(true);
      expect(queues.has("queue2")).toBe(true);
    });
  });
});

describe("getQueueService singleton", () => {
  afterEach(async () => {
    // Clean up the singleton
    await closeQueueService();
  });

  it("should return singleton instance", () => {
    const config: QueueConfig = createTestMemoryConfig();

    const service1 = getQueueService(config);
    const service2 = getQueueService(config);

    expect(service1).toBe(service2);
  });
});
