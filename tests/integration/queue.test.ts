import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { testRedis } from "./setup";
import { QueueService } from "@forge/queue";
import type { QueueConfig } from "@forge/queue";

function createTestQueueConfig(): QueueConfig {
  const { host, port } = testRedis.getConfig();
  return {
    connection: {
      type: "redis",
      redis: { host, port, db: 2 },
    },
  };
}

describe("Queue Integration", () => {
  let queueService: QueueService;

  beforeAll(() => {
    queueService = new QueueService(createTestQueueConfig());
  });

  afterAll(async () => {
    await queueService.close();
  });

  describe("Job Management", () => {
    it("should add a job to the queue", async () => {
      const jobId = await queueService.addJob("test-queue", "test-job", {
        message: "Hello, Queue!",
        timestamp: Date.now(),
      });

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe("string");
    });

    it("should get job counts", async () => {
      await queueService.addJob("test-queue", "count-job-1", { test: true });
      await queueService.addJob("test-queue", "count-job-2", { test: true });

      const health = await queueService.getHealth("test-queue");

      expect(health.counts.waiting).toBeGreaterThanOrEqual(2);
      expect(health.counts.completed).toBeDefined();
      expect(health.counts.failed).toBeDefined();
    });
  });

  describe("Job Processing", () => {
    it("should process a job with a worker", async () => {
      const processService = new QueueService(createTestQueueConfig());

      let processedData: unknown = null;

      processService.registerWorker(
        "process-test-queue",
        async (context) => {
          processedData = context.job.data;
          return { success: true };
        },
        { concurrency: 1 }
      );

      await processService.addJob("process-test-queue", "process-job", {
        message: "Process me!",
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(processedData).toBeDefined();
      expect((processedData as { message: string }).message).toBe("Process me!");

      await processService.close();
    }, 10000);

    it("should report queue health", async () => {
      const healthService = new QueueService(createTestQueueConfig());
      await healthService.addJob("health-test-queue", "health-job", { test: true });

      const health = await healthService.getHealth("health-test-queue");

      expect(health).toBeDefined();
      expect(typeof health.healthy).toBe("boolean");
      expect(health.counts).toBeDefined();

      await healthService.close();
    });
  });

  describe("Queue Control", () => {
    it("should pause and resume queues", async () => {
      const controlService = new QueueService(createTestQueueConfig());
      await controlService.addJob("control-test-queue", "ctrl-job", { test: true });

      await controlService.pauseAll();

      const health = await controlService.getHealth("control-test-queue");
      expect(health.isPaused).toBe(true);

      await controlService.resumeAll();

      const resumedHealth = await controlService.getHealth("control-test-queue");
      expect(resumedHealth.isPaused).toBe(false);

      await controlService.close();
    });

    it("should clean queues", async () => {
      const cleanService = new QueueService(createTestQueueConfig());

      await cleanService.cleanQueues(0, 1000);

      await cleanService.close();
    });
  });

  describe("Queue Metrics", () => {
    it("should return queue metrics", async () => {
      const metricsService = new QueueService(createTestQueueConfig());
      await metricsService.addJob("metrics-test-queue", "metrics-job", { test: true });

      const metrics = await metricsService.getMetrics();

      expect(metrics.queues).toBeGreaterThanOrEqual(1);
      expect(metrics.totalJobs).toBeDefined();

      await metricsService.close();
    });
  });
});
