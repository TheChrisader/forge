import { QueueService, QUEUE_NAMES } from "@forge/queue";
import type { QueueConfig } from "@forge/queue";
import type { TestRedis } from "./redis";

/**
 * Test queue manager that creates an isolated QueueService against test Redis.
 * Uses Redis DB 2 to avoid conflicts with cache (DB 0/1).
 */
export class TestQueue {
  private queueService?: QueueService;
  private readonly testRedis: TestRedis;

  constructor(testRedis: TestRedis) {
    this.testRedis = testRedis;
  }

  start(): void {
    const { host, port } = this.testRedis.getConfig();

    const config: QueueConfig = {
      connection: {
        type: "redis",
        redis: {
          host,
          port,
          db: 2,
        },
      },
    };

    this.queueService = new QueueService(config);
  }

  async stop(): Promise<void> {
    if (this.queueService) {
      await this.queueService.close();
      this.queueService = undefined;
    }
  }

  async purge(): Promise<void> {
    if (!this.queueService) {
      throw new Error("Queue not started. Call start() first.");
    }

    for (const name of Object.values(QUEUE_NAMES)) {
      try {
        const queue = this.queueService.getQueue(name);
        await queue.clean(0, 1000, "completed");
        await queue.clean(0, 1000, "failed");
        await queue.obliterate();
      } catch {
        // Queue may not have been created yet
      }
    }
  }

  getService(): QueueService {
    if (!this.queueService) {
      throw new Error("Queue not started. Call start() first.");
    }
    return this.queueService;
  }
}
