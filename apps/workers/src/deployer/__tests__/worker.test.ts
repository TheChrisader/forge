/**
 * Tests for DeployerWorker
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Create mock objects using hoisted so they can be used in vi.mock
const { mockQueueService, MockQueueService, queueConfig, mockWorker } = vi.hoisted(() => {
  const onCompletedCallback = vi.fn();
  const onFailedCallback = vi.fn();

  const mockWorker = {
    onCompleted: vi.fn((cb) => {
      onCompletedCallback.mockImplementation(cb);
    }),
    onFailed: vi.fn((cb) => {
      onFailedCallback.mockImplementation(cb);
    }),
    onCompletedCallback,
    onFailedCallback,
  };

  const mockQueueService = {
    registerWorker: vi.fn(() => mockWorker),
    close: vi.fn(),
  };

  class MockQueueService {
    constructor(_: unknown) {
      return mockQueueService;
    }
  }

  const queueConfig = {
    redis: {
      host: "localhost",
      port: 6379,
      db: 0,
    },
  };

  return {
    mockQueueService,
    MockQueueService,
    queueConfig,
    mockWorker,
  };
});

vi.mock("@forge/queue", () => ({
  QueueService: MockQueueService,
}));

import { DeployerWorker } from "../worker.js";

describe("DeployerWorker", () => {
  let worker: DeployerWorker;

  afterEach(async () => {
    if (worker) {
      await worker.close();
    }
    vi.clearAllMocks();
  });

  it("should initialize with default options", () => {
    worker = new DeployerWorker(queueConfig);

    expect(mockQueueService.registerWorker).toHaveBeenCalledWith(
      "deploy",
      expect.any(Function),
      {
        concurrency: 5,
        limiter: {
          max: 20,
          duration: 60_000,
        },
      }
    );

    // Verify event handlers were set up
    expect(mockWorker.onCompleted).toHaveBeenCalledWith(expect.any(Function));
    expect(mockWorker.onFailed).toHaveBeenCalledWith(expect.any(Function));
  });

  it("should initialize with custom concurrency", () => {
    worker = new DeployerWorker(queueConfig, { concurrency: 10 });

    expect(mockQueueService.registerWorker).toHaveBeenCalledWith(
      "deploy",
      expect.any(Function),
      {
        concurrency: 10,
        limiter: {
          max: 20,
          duration: 60_000,
        },
      }
    );
  });

  it("should initialize with custom rate limiter", () => {
    worker = new DeployerWorker(queueConfig, {
      limiter: { max: 50, duration: 30_000 },
    });

    expect(mockQueueService.registerWorker).toHaveBeenCalledWith(
      "deploy",
      expect.any(Function),
      {
        concurrency: 5,
        limiter: {
          max: 50,
          duration: 30_000,
        },
      }
    );
  });

  it("should close gracefully", async () => {
    worker = new DeployerWorker(queueConfig);
    mockQueueService.close.mockResolvedValue(undefined);

    await worker.close();

    expect(mockQueueService.close).toHaveBeenCalled();
  });

  it("should call onCompleted callback for completed jobs", () => {
    worker = new DeployerWorker(queueConfig);

    // Simulate job completion by calling the registered callback
    mockWorker.onCompletedCallback({ id: "job-123" });

    // The callback is just a logging function, we just verify it doesn't throw
    expect(mockWorker.onCompleted).toHaveBeenCalled();
  });

  it("should call onFailed callback for failed jobs", () => {
    worker = new DeployerWorker(queueConfig);

    // Simulate job failure by calling the registered callback
    const error = new Error("Test error");
    mockWorker.onFailedCallback({ id: "job-123" }, error);

    // The callback is just a logging function, we just verify it doesn't throw
    expect(mockWorker.onFailed).toHaveBeenCalled();
  });
});
