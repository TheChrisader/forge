import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DeployJobData } from "@forge/types";
import type { IJobContext, QueueConfig } from "@forge/queue";

const {
  mockDb,
  mockRuntime,
  getDatabaseClientMock,
  MockDockerRuntime,
  mockOrchestrator,
  MockDeploymentOrchestrator,
  mockLock,
  MockRedisDeployLock,
  mockStrategyRegistry,
} = vi.hoisted(() => {
  const mockRuntime = {
    create: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    remove: vi.fn(),
    waitForHealthy: vi.fn(),
    listNetworks: vi.fn(),
    createNetwork: vi.fn(),
    listVolumes: vi.fn(),
    createVolume: vi.fn(),
  };

  class MockDockerRuntime {
    constructor() {
      return mockRuntime;
    }
  }

  const mockDb = {
    deployment: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    project: {
      update: vi.fn(),
    },
    container: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const getDatabaseClientMock = vi.fn(() => mockDb);

  const mockOrchestrator = {
    deploy: vi.fn(),
    handleFailure: vi.fn(),
  };

  class MockDeploymentOrchestrator {
    constructor() {
      return mockOrchestrator;
    }
  }

  const mockLock = {
    acquire: vi.fn(),
    release: vi.fn(),
    extend: vi.fn(),
    acquireProjectLock: vi.fn(),
    releaseProjectLock: vi.fn(),
    extendProjectLock: vi.fn(),
  };

  class MockRedisDeployLock {
    constructor() {
      return mockLock;
    }
  }

  const mockStrategyRegistry = {
    register: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn(),
  };

  return {
    mockDb,
    mockRuntime,
    getDatabaseClientMock,
    MockDockerRuntime,
    mockOrchestrator,
    MockDeploymentOrchestrator,
    mockLock,
    MockRedisDeployLock,
    mockStrategyRegistry,
  };
});

vi.mock("@forge/database", () => ({
  getDatabaseClient: getDatabaseClientMock,
}));

vi.mock("@forge/docker", () => ({
  DockerRuntime: MockDockerRuntime,
}));

vi.mock("@forge/core", async () => {
  const actual = await vi.importActual("@forge/core");
  class MockBuildLogService {
    getLineCount = vi.fn().mockResolvedValue(0);
    appendBatch = vi.fn().mockResolvedValue(undefined);
  }
  return {
    ...actual,
    BuildLogService: MockBuildLogService,
  };
});

vi.mock("@forge/deploy", () => {
  class MockContainerLifecycle {
    createContainer = vi.fn();
    startContainer = vi.fn();
    waitForHealthy = vi.fn();
    stopAndRemoveWithContext = vi.fn();
  }
  return {
    createDefaultStrategyRegistry: vi.fn(() => mockStrategyRegistry),
    ContainerLifecycle: MockContainerLifecycle,
  };
});

vi.mock("@forge/security", () => ({
  decrypt: vi.fn((val: string) => val),
}));

vi.mock("@forge/queue", async () => {
  const actual = await vi.importActual("@forge/queue");
  return {
    ...actual,
    RedisDeployLock: MockRedisDeployLock,
  };
});

vi.mock("../../deployment-orchestrator.service.js", () => ({
  DeploymentOrchestrator: MockDeploymentOrchestrator,
}));

import { handleDeployJob } from "../deploy.handler.js";
import type { IProxyIntegration } from "@forge/proxy";

const mockProxyIntegration: IProxyIntegration = {
  onContainerDeployed: vi.fn(),
  onContainerRemoved: vi.fn(),
} as unknown as IProxyIntegration;

const queueConfig: QueueConfig = {
  connection: {
    type: "redis",
    redis: { host: "localhost", port: 6379, db: 0 },
  },
};

const mockContext: IJobContext<DeployJobData> = {
  job: {
    id: "test-job-1",
    name: "deploy",
    data: {
      deploymentId: "deploy-123",
      projectId: "project-456",
      image: "forge/test-project:v1.0.0",
    },
    progress: 0,
    attemptsMade: 0,
    timestamp: Date.now(),
    opts: {},
  },
  updateProgress: vi.fn().mockResolvedValue(undefined),
};

describe("handleDeployJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SECRETS_ENCRYPTION_KEY = "test-encryption-key-32bytes!!";

    mockLock.acquire.mockResolvedValue("lock-token-123");
    mockLock.release.mockResolvedValue(true);
    mockLock.extend.mockResolvedValue(true);
    mockLock.acquireProjectLock.mockResolvedValue("project-lock-token-456");
    mockLock.releaseProjectLock.mockResolvedValue(true);
    mockLock.extendProjectLock.mockResolvedValue(true);

    mockDb.container.findMany.mockResolvedValue([]);

    mockOrchestrator.deploy.mockResolvedValue(undefined);
    mockOrchestrator.handleFailure.mockResolvedValue(undefined);
  });

  it("should process deploy job successfully", async () => {
    await handleDeployJob(mockContext, mockProxyIntegration, mockRuntime as any, queueConfig);

    expect(mockLock.acquire).toHaveBeenCalledWith("deploy-123", 300000);
    expect(mockLock.acquireProjectLock).toHaveBeenCalledWith("project-456", 300000);
    expect(mockOrchestrator.deploy).toHaveBeenCalledWith(
      "deploy-123",
      "forge/test-project:v1.0.0",
      {
        progressCallback: expect.any(Function),
      }
    );
    expect(mockLock.release).toHaveBeenCalledWith("deploy-123", "lock-token-123");
    expect(mockLock.releaseProjectLock).toHaveBeenCalledWith(
      "project-456",
      "project-lock-token-456"
    );
  });

  it("should handle deployment not found error", async () => {
    mockOrchestrator.deploy.mockRejectedValue(new Error("Deployment deploy-123 not found"));

    await expect(
      handleDeployJob(mockContext, mockProxyIntegration, mockRuntime as any, queueConfig)
    ).rejects.toThrow("Deployment deploy-123 not found");

    expect(mockOrchestrator.handleFailure).toHaveBeenCalledWith(
      "deploy-123",
      "Deployment deploy-123 not found"
    );
  });

  it("should handle health check failure", async () => {
    mockOrchestrator.deploy.mockRejectedValue(new Error("Container failed health check"));

    await expect(
      handleDeployJob(mockContext, mockProxyIntegration, mockRuntime as any, queueConfig)
    ).rejects.toThrow("Container failed health check");

    expect(mockOrchestrator.handleFailure).toHaveBeenCalled();
  });

  it("should skip duplicate job when deploy lock is already held", async () => {
    mockLock.acquire.mockResolvedValue(null);

    await handleDeployJob(mockContext, mockProxyIntegration, mockRuntime as any, queueConfig);

    expect(mockOrchestrator.deploy).not.toHaveBeenCalled();
    expect(mockLock.release).not.toHaveBeenCalled();
  });

  it("should skip concurrent project deploy when project lock is held", async () => {
    mockLock.acquireProjectLock.mockResolvedValue(null);

    await handleDeployJob(mockContext, mockProxyIntegration, mockRuntime as any, queueConfig);

    expect(mockOrchestrator.deploy).not.toHaveBeenCalled();
    expect(mockLock.release).toHaveBeenCalledWith("deploy-123", "lock-token-123");
  });

  it("should use the image from job data", async () => {
    await handleDeployJob(mockContext, mockProxyIntegration, mockRuntime as any, queueConfig);

    expect(mockOrchestrator.deploy).toHaveBeenCalledWith(
      "deploy-123",
      "forge/test-project:v1.0.0",
      expect.anything()
    );
  });

  it("should clean up leftover containers on retry", async () => {
    const retryContext: IJobContext<DeployJobData> = {
      ...mockContext,
      job: { ...mockContext.job, attemptsMade: 1 },
    };

    mockDb.container.findMany.mockResolvedValue([
      { containerId: "leftover-container-1" },
      { containerId: "leftover-container-2" },
    ]);

    await handleDeployJob(retryContext, mockProxyIntegration, mockRuntime as any, queueConfig);

    expect(mockRuntime.stop).toHaveBeenCalledTimes(2);
    expect(mockRuntime.remove).toHaveBeenCalledTimes(2);

    expect(mockDb.container.updateMany).toHaveBeenCalledWith({
      where: {
        deploymentId: "deploy-123",
        status: { in: ["CREATING", "STARTING", "RUNNING", "HEALTHY", "UNHEALTHY", "ERROR"] },
      },
      data: { status: "TERMINATED", healthStatus: "UNHEALTHY" },
    });
  });

  it("should release locks even if deploy fails", async () => {
    mockOrchestrator.deploy.mockRejectedValue(new Error("Deploy failed"));

    await expect(
      handleDeployJob(mockContext, mockProxyIntegration, mockRuntime as any, queueConfig)
    ).rejects.toThrow("Deploy failed");

    expect(mockLock.release).toHaveBeenCalledWith("deploy-123", "lock-token-123");
    expect(mockLock.releaseProjectLock).toHaveBeenCalledWith(
      "project-456",
      "project-lock-token-456"
    );
  });
});
