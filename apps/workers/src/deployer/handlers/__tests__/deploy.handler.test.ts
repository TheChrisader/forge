import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DeployJobData } from "@forge/types";
import type { IJobContext } from "@forge/queue";

// Create mock objects using hoisted so they can be used in vi.mock
const { mockDb, mockRuntime, MockDockerRuntime, getDatabaseClientMock, createTransactionMock } =
  vi.hoisted(() => {
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

    const getDatabaseClientMock = vi.fn(() => mockDb);

    // Create a transaction mock that provides all Prisma methods
    const createTransactionMock = (): {
      mock: (callback: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
      txMock: unknown;
    } => {
      const txMock = {
        container: {
          create: vi.fn(),
        },
        portMapping: {
          createMany: vi.fn(),
        },
        volumeMapping: {
          createMany: vi.fn(),
        },
        healthCheckConfig: {
          create: vi.fn(),
        },
        networkAttachment: {
          create: vi.fn(),
        },
        resourceLimit: {
          create: vi.fn(),
        },
      };

      const mock = async (callback: (tx: unknown) => Promise<unknown>): Promise<unknown> => {
        return await callback(txMock);
      };

      Object.assign(mock, txMock);

      return { mock, txMock };
    };

    const mockDb = {
      deployment: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      project: {
        update: vi.fn(),
      },
      container: {
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    const _mockQueueService = {
      addJob: vi.fn(),
      close: vi.fn(),
    };

    return {
      mockDb,
      mockRuntime,
      _mockQueueService,
      MockDockerRuntime,
      getDatabaseClientMock,
      createTransactionMock,
    };
  });

vi.mock("@forge/database", () => ({
  getDatabaseClient: getDatabaseClientMock,
}));

vi.mock("@forge/docker", () => ({
  DockerRuntime: MockDockerRuntime,
}));

import { handleDeployJob } from "../deploy.handler.js";

describe("handleDeployJob", () => {
  let transactionMock: {
    container: { create: ReturnType<typeof vi.fn> };
    portMapping: { createMany: ReturnType<typeof vi.fn> };
    volumeMapping: { createMany: ReturnType<typeof vi.fn> };
    healthCheckConfig: { create: ReturnType<typeof vi.fn> };
    networkAttachment: { create: ReturnType<typeof vi.fn> };
    resourceLimit: { create: ReturnType<typeof vi.fn> };
  };

  const mockDeployment = {
    id: "deploy-123",
    version: 1,
    project: {
      id: "project-456",
      name: "test-project",
      config: {
        port: 3000,
        env: { NODE_ENV: "production" },
        healthCheck: {
          test: ["CMD", "curl", "-f", "http://localhost:3000/health"],
          interval: "10s",
          timeout: "5s",
          retries: 3,
          startPeriod: "30s",
        },
      },
    },
  };

  const mockContainer = {
    id: "container-789",
    containerId: "docker-container-abc",
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

  beforeEach(() => {
    vi.clearAllMocks();

    const { mock: txMock } = createTransactionMock();
    transactionMock = txMock as unknown as typeof transactionMock;
    mockDb.$transaction = txMock as any;

    mockDb.deployment.findUnique.mockResolvedValue(mockDeployment);
    mockDb.deployment.update.mockResolvedValue({});
    mockDb.project.update.mockResolvedValue({});
    mockDb.container.update.mockResolvedValue({});
    mockDb.container.updateMany.mockResolvedValue({});

    transactionMock.container.create.mockResolvedValue(mockContainer);

    mockRuntime.create.mockResolvedValue({
      id: "docker-container-abc",
    });
    mockRuntime.start.mockResolvedValue(undefined);
    mockRuntime.waitForHealthy.mockResolvedValue(undefined);
    mockRuntime.listNetworks.mockResolvedValue([]);
    mockRuntime.createNetwork.mockResolvedValue({});
    mockRuntime.listVolumes.mockResolvedValue([]);
    mockRuntime.createVolume.mockResolvedValue({});
  });

  it("should process deploy job successfully", async () => {
    await handleDeployJob(mockContext);

    expect(mockDb.deployment.findUnique).toHaveBeenCalledWith({
      where: { id: "deploy-123" },
      include: {
        project: {
          select: { id: true, name: true, config: true },
        },
      },
    });

    expect(mockDb.deployment.update).toHaveBeenCalledWith({
      where: { id: "deploy-123" },
      data: {
        status: "DEPLOYING",
        deployStartedAt: expect.any(Date),
        buildImage: "forge/test-project:v1.0.0",
      },
    });

    expect(mockRuntime.create).toHaveBeenCalled();

    expect(mockRuntime.start).toHaveBeenCalledWith("docker-container-abc");

    expect(mockRuntime.waitForHealthy).toHaveBeenCalledWith("docker-container-abc", {
      timeout: 120_000,
    });

    expect(mockDb.deployment.update).toHaveBeenCalledWith({
      where: { id: "deploy-123" },
      data: {
        status: "RUNNING",
        deployCompletedAt: expect.any(Date),
      },
    });

    expect(mockDb.project.update).toHaveBeenCalledWith({
      where: { id: "project-456" },
      data: { status: "ACTIVE" },
    });

    expect(mockDb.container.update).toHaveBeenCalledWith({
      where: { id: "container-789" },
      data: { status: "HEALTHY", healthStatus: "HEALTHY" },
    });
  });

  it("should handle deployment not found error", async () => {
    mockDb.deployment.findUnique.mockResolvedValue(null);

    await expect(handleDeployJob(mockContext)).rejects.toThrow("Deployment deploy-123 not found");
  });

  it("should handle health check failure", async () => {
    mockRuntime.waitForHealthy.mockRejectedValue(new Error("Health check timeout"));

    await expect(handleDeployJob(mockContext)).rejects.toThrow();

    expect(mockRuntime.stop).toHaveBeenCalledWith("docker-container-abc", {
      timeout: 10_000,
    });
    expect(mockRuntime.remove).toHaveBeenCalledWith("docker-container-abc", {
      force: true,
    });

    expect(mockDb.deployment.update).toHaveBeenCalledWith({
      where: { id: "deploy-123" },
      data: {
        status: "FAILED",
        deployCompletedAt: expect.any(Date),
        error: "Container failed health check",
      },
    });
  });

  it("should handle container creation failure", async () => {
    mockRuntime.create.mockRejectedValue(new Error("Docker daemon not available"));

    await expect(handleDeployJob(mockContext)).rejects.toThrow();

    expect(mockDb.deployment.update).toHaveBeenCalled();
  });

  it("should use the image from job data", async () => {
    await handleDeployJob(mockContext);

    expect(mockRuntime.create).toHaveBeenCalledWith(
      expect.objectContaining({
        image: "forge/test-project:v1.0.0",
      })
    );
  });

  it("should create project network", async () => {
    await handleDeployJob(mockContext);

    expect(mockRuntime.listNetworks).toHaveBeenCalledWith({
      name: ["forge-project-project-456"],
    });

    expect(mockRuntime.createNetwork).toHaveBeenCalledWith({
      name: "forge-project-project-456",
      driver: "bridge",
      internal: false,
      attachable: true,
      labels: expect.objectContaining({
        "forge.managed": "true",
        "forge.projectId": "project-456",
        "forge.type": "project-network",
      }),
    });
  });

  it("should apply container labels for Forge tracking", async () => {
    await handleDeployJob(mockContext);

    expect(mockRuntime.create).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: {
          "forge.managed": "true",
          "forge.projectId": "project-456",
          "forge.deploymentId": "deploy-123",
          "forge.type": "deployment-container",
        },
      })
    );
  });

  it("should set environment variables including Forge metadata", async () => {
    await handleDeployJob(mockContext);

    expect(mockRuntime.create).toHaveBeenCalledWith(
      expect.objectContaining({
        env: expect.objectContaining({
          NODE_ENV: "production",
          PORT: "3000",
          FORGE_PROJECT_ID: "project-456",
          FORGE_DEPLOYMENT_ID: "deploy-123",
        }),
      })
    );
  });
});
