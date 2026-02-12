import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { testRedis } from "./setup";
import { QueueClient, WorkerClient } from "@forge/queue";

/**
 * Queue Integration Tests
 *
 * These tests use the TestRedis container for isolation.
 */
describe("Queue Integration", () => {
  let queueClient: QueueClient;
  let workerClient: WorkerClient;

  beforeAll(() => {
    const config = {
      redis: testRedis.getConfig(),
    };

    queueClient = new QueueClient("test-queue", config);
  });

  afterAll(async () => {
    if (workerClient) {
      await workerClient.close();
    }
    if (queueClient) {
      await queueClient.close();
    }
  });

  describe("Job Management", () => {
    it("should add a job to the queue", async () => {
      const job = await queueClient.addJob("test-job", {
        message: "Hello, Queue!",
        timestamp: Date.now(),
      });

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.name).toBe("test-job");
    });

    it("should add multiple jobs in bulk", async () => {
      const jobs = await queueClient.addBulk([
        { name: "bulk-job-1", data: { index: 1 } },
        { name: "bulk-job-2", data: { index: 2 } },
        { name: "bulk-job-3", data: { index: 3 } },
      ]);

      expect(jobs).toHaveLength(3);
      expect(jobs[0].name).toBe("bulk-job-1");
      expect(jobs[1].name).toBe("bulk-job-2");
      expect(jobs[2].name).toBe("bulk-job-3");
    });

    it("should get job counts", async () => {
      await queueClient.addBulk([
        { name: "count-job-1", data: { test: true } },
        { name: "count-job-2", data: { test: true } },
      ]);

      const counts = await queueClient.getJobCounts();

      expect(counts.waiting).toBeGreaterThanOrEqual(2);
      expect(counts.active).toBeDefined();
      expect(counts.completed).toBeDefined();
      expect(counts.failed).toBeDefined();
    });

    it("should get a specific job by ID", async () => {
      const job = await queueClient.addJob("get-job-test", { value: 42 });

      const retrieved = await queueClient.getJob(job.id!);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(job.id);
      expect(retrieved?.data).toEqual({ value: 42 });
    });
  });

  describe("Job Processing", () => {
    it("should process a job", async () => {
      const config = {
        redis: testRedis.getConfig(),
      };

      const testQueue = new QueueClient("process-test-queue", config);

      let processedData: unknown = null;

      workerClient = new WorkerClient(
        "process-test-queue",
        async (job) => {
          processedData = job.data;
          return { success: true, processedAt: new Date().toISOString() };
        },
        config
      );

      await testQueue.addJob("process-job", {
        message: "Process me!",
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(processedData).toBeDefined();
      expect((processedData as { message: string }).message).toBe("Process me!");

      await workerClient.close();
      await testQueue.close();
    }, 10000);

    it("should handle job failures with retries", async () => {
      const config = {
        redis: testRedis.getConfig(),
      };

      const failQueue = new QueueClient("fail-test-queue", config);

      let attempts = 0;

      const failWorker = new WorkerClient(
        "fail-test-queue",
        async () => {
          attempts++;
          throw new Error("Intentional failure for testing");
        },
        config
      );

      await failQueue.addJob("failing-job", { test: true }, { attempts: 3 });

      await new Promise((resolve) => setTimeout(resolve, 5000));

      expect(attempts).toBe(3);

      await failWorker.close();
      await failQueue.close();
    }, 15000);
  });

  describe("Queue Control", () => {
    it("should pause and resume the queue", async () => {
      const config = {
        redis: testRedis.getConfig(),
      };

      const controlQueue = new QueueClient("control-test-queue", config);

      await controlQueue.pause();

      const isPaused = await controlQueue.isPaused();
      expect(isPaused).toBe(true);

      await controlQueue.resume();

      const isResumed = await controlQueue.isPaused();
      expect(isResumed).toBe(false);

      await controlQueue.close();
    });

    it("should clean completed jobs", async () => {
      const config = {
        redis: testRedis.getConfig(),
      };

      const cleanQueue = new QueueClient("clean-test-queue", config);

      const cleanWorker = new WorkerClient(
        "clean-test-queue",
        async () => {
          return { done: true };
        },
        config
      );

      await cleanQueue.addJob("to-complete", { test: true });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      await cleanQueue.clean(0, 100, "completed");

      const counts = await cleanQueue.getJobCounts();
      expect(counts.completed).toBe(0);

      await cleanWorker.close();
      await cleanQueue.close();
    }, 10000);
  });

  describe("Worker Events", () => {
    it("should emit completed event", async () => {
      const config = {
        redis: testRedis.getConfig(),
      };

      const eventQueue = new QueueClient("event-test-queue", config);

      const completedJobs: string[] = [];

      const eventWorker = new WorkerClient(
        "event-test-queue",
        async (job) => {
          return { id: job.id };
        },
        config
      );

      eventWorker.onCompleted((job) => {
        completedJobs.push(job.id!);
      });

      await eventQueue.addJob("event-job", { test: true });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(completedJobs.length).toBeGreaterThan(0);

      await eventWorker.close();
      await eventQueue.close();
    }, 10000);

    it("should emit failed event", async () => {
      const config = {
        redis: testRedis.getConfig(),
      };

      const failEventQueue = new QueueClient("fail-event-test-queue", config);

      const failedJobs: string[] = [];

      const failEventWorker = new WorkerClient(
        "fail-event-test-queue",
        async () => {
          throw new Error("Test failure");
        },
        config
      );

      failEventWorker.onFailed((job) => {
        if (job) {
          failedJobs.push(job.id!);
        }
      });

      await failEventQueue.addJob("fail-event-job", { test: true }, { attempts: 1 });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(failedJobs.length).toBeGreaterThan(0);

      await failEventWorker.close();
      await failEventQueue.close();
    }, 10000);
  });

  describe("Job Options", () => {
    it("should respect job delay", async () => {
      const config = {
        redis: testRedis.getConfig(),
      };

      const delayQueue = new QueueClient("delay-test-queue", config);

      const startTime = Date.now();
      let processedTime = 0;

      const delayWorker = new WorkerClient(
        "delay-test-queue",
        async () => {
          processedTime = Date.now();
          return { done: true };
        },
        config
      );

      await delayQueue.addJob("delayed-job", { test: true }, { delay: 2000 });

      await new Promise((resolve) => setTimeout(resolve, 4000));

      const elapsed = processedTime - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(1900); // Allow some margin

      await delayWorker.close();
      await delayQueue.close();
    }, 10000);

    it("should set job priority", async () => {
      const config = {
        redis: testRedis.getConfig(),
      };

      const priorityQueue = new QueueClient("priority-test-queue", config);

      const lowPriority = await priorityQueue.addJob("low", { priority: "low" }, { priority: 10 });
      const highPriority = await priorityQueue.addJob(
        "high",
        { priority: "high" },
        { priority: 1 }
      );

      expect(lowPriority.id).toBeDefined();
      expect(highPriority.id).toBeDefined();

      await priorityQueue.close();
    });
  });
});
