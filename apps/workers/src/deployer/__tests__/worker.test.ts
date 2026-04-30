/**
 * Tests for DeployerWorker
 */

import { describe, it, expect, vi, afterEach } from "vitest";

const { mockQueueService, MockQueueService, queueConfig, mockWorker, MockDockerRuntime } =
  vi.hoisted(() => {
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
      connection: {
        type: "redis" as const,
        redis: {
          host: "localhost",
          port: 6379,
          db: 0,
        },
      },
    };

    const mockRuntime = {};

    class MockDockerRuntime {
      constructor() {
        return mockRuntime;
      }
    }

    return {
      mockQueueService,
      MockQueueService,
      queueConfig,
      mockWorker,
      MockDockerRuntime,
    };
  });

vi.mock("@forge/queue", () => ({
  QueueService: MockQueueService,
}));

vi.mock("@forge/docker", () => ({
  DockerRuntime: MockDockerRuntime,
}));

vi.mock("@forge/database", () => ({
  getDatabaseClient: vi.fn(),
}));

vi.mock("@forge/proxy", () => ({
  ReverseProxyFactory: vi.fn(),
  NoOpProxyIntegration: vi.fn(),
}));

vi.mock("../deployment-reconciler.js", () => {
  class MockDeploymentReconciler {
    start = vi.fn().mockResolvedValue(undefined);
    stop = vi.fn();
  }
  return {
    DeploymentReconciler: MockDeploymentReconciler,
  };
});

import { DeployerWorker } from "../worker.js";

describe("DeployerWorker", () => {
  let worker: DeployerWorker;

  afterEach(async () => {
    if (worker) {
      await worker.close();
    }
    vi.clearAllMocks();
  });

  it("should construct without calling registerWorker", () => {
    worker = new DeployerWorker(queueConfig);

    // Constructor should NOT call registerWorker (that's in initialize())
    expect(mockQueueService.registerWorker).not.toHaveBeenCalled();
  });

  it("should register worker on initialize with default options", async () => {
    worker = new DeployerWorker(queueConfig);
    await worker.initialize();

    expect(mockQueueService.registerWorker).toHaveBeenCalledWith("deploy", expect.any(Function), {
      concurrency: 5,
      limiter: {
        max: 20,
        duration: 60_000,
      },
    });

    // Verify event handlers were set up
    expect(mockWorker.onCompleted).toHaveBeenCalledWith(expect.any(Function));
    expect(mockWorker.onFailed).toHaveBeenCalledWith(expect.any(Function));
  });

  it("should initialize with custom concurrency", async () => {
    worker = new DeployerWorker(queueConfig, { concurrency: 10 });
    await worker.initialize();

    expect(mockQueueService.registerWorker).toHaveBeenCalledWith("deploy", expect.any(Function), {
      concurrency: 10,
      limiter: {
        max: 20,
        duration: 60_000,
      },
    });
  });

  it("should initialize with custom rate limiter", async () => {
    worker = new DeployerWorker(queueConfig, {
      limiter: { max: 50, duration: 30_000 },
    });
    await worker.initialize();

    expect(mockQueueService.registerWorker).toHaveBeenCalledWith("deploy", expect.any(Function), {
      concurrency: 5,
      limiter: {
        max: 50,
        duration: 30_000,
      },
    });
  });

  it("should close gracefully", async () => {
    worker = new DeployerWorker(queueConfig);
    mockQueueService.close.mockResolvedValue(undefined);

    await worker.close();

    expect(mockQueueService.close).toHaveBeenCalled();
  });

  it("should call onCompleted callback for completed jobs", async () => {
    worker = new DeployerWorker(queueConfig);
    await worker.initialize();

    // Simulate job completion by calling the registered callback
    mockWorker.onCompletedCallback({ id: "job-123" });

    // The callback is just a logging function, we just verify it doesn't throw
    expect(mockWorker.onCompleted).toHaveBeenCalled();
  });

  it("should call onFailed callback for failed jobs", async () => {
    worker = new DeployerWorker(queueConfig);
    await worker.initialize();

    // Simulate job failure by calling the registered callback
    const error = new Error("Test error");
    mockWorker.onFailedCallback({ id: "job-123" }, error);

    // The callback is just a logging function, we just verify it doesn't throw
    expect(mockWorker.onFailed).toHaveBeenCalled();
  });
});
