import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  mockDb,
  MockDockerRuntime,
  mockRuntime,
  mockMetricsCollector,
  MockMetricsCollector,
  mockLogger,
} = vi.hoisted(() => {
  const mockDb = {
    container: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    alertRule: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };

  const mockRuntime = {
    list: vi.fn(),
    inspect: vi.fn(),
    stats: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };

  class MockDockerRuntime {
    constructor() {
      return mockRuntime;
    }
  }

  const mockMetricsCollector = {
    start: vi.fn(),
    stop: vi.fn(),
    record: vi.fn(),
    recordMany: vi.fn(),
  };

  class MockMetricsCollector {
    constructor() {
      return mockMetricsCollector;
    }
  }

  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  return {
    mockDb,
    MockDockerRuntime,
    mockRuntime,
    mockMetricsCollector,
    MockMetricsCollector,
    mockLogger,
  };
});

vi.mock("@forge/database", () => ({
  getDatabaseClient: vi.fn(() => mockDb),
}));

vi.mock("@forge/docker", () => ({
  DockerRuntime: MockDockerRuntime,
}));

vi.mock("@forge/observability", () => ({
  MetricsCollector: MockMetricsCollector,
  collectDockerStats: vi.fn().mockReturnValue([]),
}));

vi.mock("@forge/logger", () => {
  class MockLoggerService {
    constructor() {
      return mockLogger;
    }
  }
  return { LoggerService: MockLoggerService };
});

vi.mock("../notifier/dispatch-alert.js", () => ({
  createAlertAndDispatch: vi.fn().mockResolvedValue(undefined),
}));

import { DeploymentHealthMonitor } from "../deployment-health-monitor.js";

describe("DeploymentHealthMonitor", () => {
  let monitor: DeploymentHealthMonitor;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRuntime.list.mockResolvedValue([]);
  });

  afterEach(() => {
    monitor?.stop();
  });

  it("should start and set up polling interval", async () => {
    monitor = new DeploymentHealthMonitor({
      metricsCollector: mockMetricsCollector as any,
      pollIntervalMs: 100,
    });

    await monitor.start();

    expect(mockMetricsCollector.start).toHaveBeenCalled();
    expect(mockRuntime.list).toHaveBeenCalled(); // Docker availability check
  });

  it("should stop gracefully", async () => {
    monitor = new DeploymentHealthMonitor({
      metricsCollector: mockMetricsCollector as any,
      pollIntervalMs: 100,
    });

    await monitor.start();
    await monitor.stop();

    expect(mockMetricsCollector.stop).toHaveBeenCalled();
  });

  it("should not start twice", async () => {
    monitor = new DeploymentHealthMonitor({
      metricsCollector: mockMetricsCollector as any,
      pollIntervalMs: 100,
    });

    await monitor.start();
    await monitor.start();

    // Metrics collector start should only be called once
    expect(mockMetricsCollector.start).toHaveBeenCalledTimes(1);
  });

  it("should mark Docker as unavailable when list fails at startup", async () => {
    mockRuntime.list.mockRejectedValue(new Error("ECONNREFUSED"));

    monitor = new DeploymentHealthMonitor({
      metricsCollector: mockMetricsCollector as any,
      pollIntervalMs: 100,
    });

    await monitor.start();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      "Docker is not available at startup",
      expect.objectContaining({ error: "ECONNREFUSED" })
    );
  });

  describe("container polling", () => {
    it("should skip containers in CREATING/STARTING state", async () => {
      mockDb.container.findMany.mockResolvedValue([
        {
          id: "c-1",
          containerId: "docker-1",
          deploymentId: "d-1",
          projectId: "p-1",
          name: "test",
          status: "CREATING",
          healthStatus: null,
        },
        {
          id: "c-2",
          containerId: "docker-2",
          deploymentId: "d-2",
          projectId: "p-2",
          name: "test",
          status: "STARTING",
          healthStatus: null,
        },
      ]);

      monitor = new DeploymentHealthMonitor({
        metricsCollector: mockMetricsCollector as any,
        pollIntervalMs: 100,
      });

      await monitor.start();

      // Should not inspect CREATING/STARTING containers
      expect(mockRuntime.inspect).not.toHaveBeenCalled();
    });

    it("should inspect running containers and record health metrics", async () => {
      mockDb.container.findMany.mockResolvedValue([
        {
          id: "c-1",
          containerId: "docker-1",
          deploymentId: "d-1",
          projectId: "p-1",
          name: "test",
          status: "RUNNING",
          healthStatus: null,
        },
      ]);

      mockRuntime.inspect.mockResolvedValue({
        state: { running: true },
        health: { status: "healthy" },
      });

      mockRuntime.stats.mockResolvedValue({ cpu_stats: {}, memory_stats: {} });

      monitor = new DeploymentHealthMonitor({
        metricsCollector: mockMetricsCollector as any,
        pollIntervalMs: 100,
      });

      await monitor.start();

      expect(mockRuntime.inspect).toHaveBeenCalledWith("docker-1");
      expect(mockMetricsCollector.record).toHaveBeenCalledWith(
        expect.objectContaining({
          metric: "health_status",
          value: 1,
          sourceId: "c-1",
        })
      );
    });

    it("should detect Docker connection errors and pause polling", async () => {
      // Need 3 containers to trigger 3 consecutive Docker failures
      mockDb.container.findMany.mockResolvedValue([
        {
          id: "c-1",
          containerId: "docker-1",
          deploymentId: "d-1",
          projectId: "p-1",
          name: "test-1",
          status: "RUNNING",
          healthStatus: null,
        },
        {
          id: "c-2",
          containerId: "docker-2",
          deploymentId: "d-2",
          projectId: "p-1",
          name: "test-2",
          status: "RUNNING",
          healthStatus: null,
        },
        {
          id: "c-3",
          containerId: "docker-3",
          deploymentId: "d-3",
          projectId: "p-1",
          name: "test-3",
          status: "RUNNING",
          healthStatus: null,
        },
      ]);

      // Return connection error for each inspect call
      mockRuntime.inspect.mockRejectedValue(new Error("ECONNREFUSED: connect ECONNREFUSED"));

      monitor = new DeploymentHealthMonitor({
        metricsCollector: mockMetricsCollector as any,
        pollIntervalMs: 100,
      });

      await monitor.start();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Docker appears unavailable — pausing deployment health checks",
        expect.anything()
      );
    });
  });
});
