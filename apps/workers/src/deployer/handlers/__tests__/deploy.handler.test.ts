/**
 * Tests for deploy job handler
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DeployJobData } from "@forge/types";

// Minimal Job interface matching the handler's interface
interface Job<T = unknown> {
  id?: string;
  name: string;
  data: T;
}

// Create mock objects using hoisted so they can be used in vi.mock
const {
  mockDb,
  mockRuntime,
  mockQueueService,
  MockDockerRuntime,
  getDatabaseClientMock,
  createTransactionMock,
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

  const getDatabaseClientMock = vi.fn(() => mockDb);

  // Create a transaction mock that provides all Prisma methods
  const createTransactionMock = () => {
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

    const mock = async (callback: any) => {
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

  const mockQueueService = {
    addJob: vi.fn(),
    close: vi.fn(),
  };

  return {
    mockDb,
    mockRuntime,
    mockQueueService,
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
  let transactionMock: any;

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

  const mockJob: Partial<Job<DeployJobData>> = {
    id: "test-job-1",
    data: {
      deploymentId: "deploy-123",
      projectId: "project-456",
      image: "forge/test-project:v1.0.0",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create fresh transaction mocks
    const { mock: txMock, txMock: tx } = createTransactionMock();
    transactionMock = txMock;
    mockDb.$transaction = txMock;

    // Setup default mock behaviors
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
    await handleDeployJob(mockJob as Job<DeployJobData>);

    // Verify deployment was found
    expect(mockDb.deployment.findUnique).toHaveBeenCalledWith({
      where: { id: "deploy-123" },
      include: {
        project: {
          select: { id: true, name: true, config: true },
        },
      },
    });

    // Verify deployment status was updated to DEPLOYING
    expect(mockDb.deployment.update).toHaveBeenCalledWith({
      where: { id: "deploy-123" },
      data: {
        status: "DEPLOYING",
        deployStartedAt: expect.any(Date),
        buildImage: "forge/test-project:v1.0.0",
      },
    });

    // Verify container was created
    expect(mockRuntime.create).toHaveBeenCalled();

    // Verify container was started
    expect(mockRuntime.start).toHaveBeenCalledWith("docker-container-abc");

    // Verify health check was awaited
    expect(mockRuntime.waitForHealthy).toHaveBeenCalledWith("docker-container-abc", {
      timeout: 120_000,
    });

    // Verify deployment was marked as RUNNING
    expect(mockDb.deployment.update).toHaveBeenCalledWith({
      where: { id: "deploy-123" },
      data: {
        status: "RUNNING",
        deployCompletedAt: expect.any(Date),
      },
    });

    // Verify project was marked as ACTIVE
    expect(mockDb.project.update).toHaveBeenCalledWith({
      where: { id: "project-456" },
      data: { status: "ACTIVE" },
    });

    // Verify container was marked as HEALTHY
    expect(mockDb.container.update).toHaveBeenCalledWith({
      where: { id: "container-789" },
      data: { status: "HEALTHY", healthStatus: "HEALTHY" },
    });
  });

  it("should handle deployment not found error", async () => {
    mockDb.deployment.findUnique.mockResolvedValue(null);

    await expect(handleDeployJob(mockJob as Job<DeployJobData>)).rejects.toThrow(
      "Deployment deploy-123 not found"
    );
  });

  it("should handle health check failure", async () => {
    mockRuntime.waitForHealthy.mockRejectedValue(new Error("Health check timeout"));

    await expect(handleDeployJob(mockJob as Job<DeployJobData>)).rejects.toThrow();

    // Verify cleanup happened
    expect(mockRuntime.stop).toHaveBeenCalledWith("docker-container-abc", {
      timeout: 10_000,
    });
    expect(mockRuntime.remove).toHaveBeenCalledWith("docker-container-abc", {
      force: true,
    });

    // Verify deployment was marked as FAILED
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

    await expect(handleDeployJob(mockJob as Job<DeployJobData>)).rejects.toThrow();

    // Verify deployment status was updated (handleFailure is called by orchestrator)
    expect(mockDb.deployment.update).toHaveBeenCalled();
  });

  it("should use the image from job data", async () => {
    await handleDeployJob(mockJob as Job<DeployJobData>);

    // Verify the image from job data was used
    expect(mockRuntime.create).toHaveBeenCalledWith(
      expect.objectContaining({
        image: "forge/test-project:v1.0.0",
      })
    );
  });

  it("should create project network", async () => {
    await handleDeployJob(mockJob as Job<DeployJobData>);

    // Verify network was checked
    expect(mockRuntime.listNetworks).toHaveBeenCalledWith({
      name: ["forge-project-project-456"],
    });

    // Verify network was created (since mock returned empty array)
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
    await handleDeployJob(mockJob as Job<DeployJobData>);

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
    await handleDeployJob(mockJob as Job<DeployJobData>);

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
