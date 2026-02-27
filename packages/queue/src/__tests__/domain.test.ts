/**
 * Domain layer tests
 */

import { describe, it, expect } from "vitest";
import { createAdapterFactory } from "../factory";
import type { QueueConfig } from "../domain/types";
import type { IQueueAdapter, IWorkerAdapter } from "../domain/interfaces";
import { InMemoryQueueAdapter } from "../adapters/memory/queue.adapter";
import { InMemoryWorkerAdapter } from "../adapters/memory/worker.adapter";
import { BullMQQueueAdapter } from "../adapters/bullmq/queue.adapter";
import { QUEUE_NAMES } from "../constants";

describe("domain/types", () => {
  describe("QueueConfig", () => {
    it("should accept memory connection config", () => {
      const config: QueueConfig = {
        connection: { type: "memory" },
      };

      expect(config.connection.type).toBe("memory");
    });

    it("should accept redis connection config", () => {
      const config: QueueConfig = {
        connection: {
          type: "redis",
          redis: {
            host: "localhost",
            port: 6379,
          },
        },
      };

      expect(config.connection.type).toBe("redis");
      expect(config.connection.redis?.host).toBe("localhost");
      expect(config.connection.redis?.port).toBe(6379);
    });
  });
});

describe("domain/constants", () => {
  it("should export all queue names", () => {
    expect(QUEUE_NAMES.BUILD).toBe("build");
    expect(QUEUE_NAMES.DEPLOY).toBe("deploy");
    expect(QUEUE_NAMES.JOBS).toBe("jobs");
    expect(QUEUE_NAMES.WEBHOOKS).toBe("webhooks");
    expect(QUEUE_NAMES.NOTIFICATIONS).toBe("notifications");
  });
});

describe("domain/factories", () => {
  describe("createAdapterFactory", () => {
    it("should create InMemoryAdapterFactory for memory connection", () => {
      const config: QueueConfig = {
        connection: { type: "memory" },
      };

      const factory = createAdapterFactory(config);

      const queue = factory.createQueue("test-queue", config);
      expect(queue).toBeInstanceOf(InMemoryQueueAdapter);
    });

    it("should create BullMQAdapterFactory for redis connection", () => {
      const config: QueueConfig = {
        connection: {
          type: "redis",
          redis: { host: "localhost", port: 6379 },
        },
      };

      const factory = createAdapterFactory(config);

      const queue = factory.createQueue("test-queue", config);
      expect(queue).toBeInstanceOf(BullMQQueueAdapter);
    });

    it("should create worker with correct adapter type", () => {
      const config: QueueConfig = {
        connection: { type: "memory" },
      };

      const factory = createAdapterFactory(config);

      const worker = factory.createWorker(
        "test-worker",
        // eslint-disable-next-line @typescript-eslint/require-await
        async () => ({ success: true }),
        config
      );

      expect(worker).toBeInstanceOf(InMemoryWorkerAdapter);
    });

    it("should throw error for unsupported connection type", () => {
      const config: QueueConfig = {
        // Using 'as any' to bypass type checking for runtime test
        connection: { type: "invalid" as any },
      };

      expect(() => createAdapterFactory(config)).toThrow("Unsupported connection type: invalid");
    });
  });
});

describe("domain/interfaces", () => {
  describe("IQueueAdapter", () => {
    it("should provide all required queue methods", () => {
      const config: QueueConfig = { connection: { type: "memory" } };
      const adapter: IQueueAdapter = new InMemoryQueueAdapter("test", config);

      expect(typeof adapter.add).toBe("function");
      expect(typeof adapter.addBulk).toBe("function");
      expect(typeof adapter.getJob).toBe("function");
      expect(typeof adapter.getJobCounts).toBe("function");
      expect(typeof adapter.getJobs).toBe("function");
      expect(typeof adapter.removeJob).toBe("function");
      expect(typeof adapter.retryJob).toBe("function");
      expect(typeof adapter.clean).toBe("function");
      expect(typeof adapter.pause).toBe("function");
      expect(typeof adapter.resume).toBe("function");
      expect(typeof adapter.isPaused).toBe("function");
      expect(typeof adapter.obliterate).toBe("function");
      expect(typeof adapter.close).toBe("function");
      expect(typeof adapter.getEvents).toBe("function");
    });
  });

  describe("IWorkerAdapter", () => {
    it("should provide all required worker methods", () => {
      const config: QueueConfig = { connection: { type: "memory" } };
      const adapter: IWorkerAdapter = new InMemoryWorkerAdapter(
        "test",
        // eslint-disable-next-line @typescript-eslint/require-await
        async () => ({}),
        config
      );

      expect(typeof adapter.pause).toBe("function");
      expect(typeof adapter.resume).toBe("function");
      expect(typeof adapter.close).toBe("function");
      expect(typeof adapter.isRunning()).toBe("boolean");
      expect(typeof adapter.isPaused()).toBe("boolean");
      expect(typeof adapter.onCompleted).toBe("function");
      expect(typeof adapter.onFailed).toBe("function");
      expect(typeof adapter.onProgress).toBe("function");
    });
  });
});
