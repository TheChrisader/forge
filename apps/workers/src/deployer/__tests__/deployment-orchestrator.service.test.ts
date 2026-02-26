/**
 * Tests for DeploymentOrchestrator service
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Create mock objects using hoisted so they can be used in vi.mock
const {
  mockDb,
  mockRuntime,
  mockLogger,
  MockDockerRuntime,
  getDatabaseClientMock,
  createTransactionMock,
} = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

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
        update: vi.fn(),
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

    // The callback receives this transaction mock
    const mock = async (callback: any) => {
      return await callback(txMock);
    };

    // Also assign methods to the mock for expectations
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

  return {
    mockDb,
    mockRuntime,
    mockLogger,
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

import { DeploymentOrchestrator } from "../deployment-orchestrator.service.js";

describe("DeploymentOrchestrator", () => {
  let orchestrator: DeploymentOrchestrator;
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

    orchestrator = new DeploymentOrchestrator(mockDb as any, mockRuntime as any, mockLogger as any);
  });

  describe("deploy", () => {
    it("should successfully deploy a container", async () => {
      await orchestrator.deploy("deploy-123", "forge/test-project:latest");

      // Verify deployment was updated to DEPLOYING
      expect(mockDb.deployment.update).toHaveBeenCalledWith({
        where: { id: "deploy-123" },
        data: {
          status: "DEPLOYING",
          deployStartedAt: expect.any(Date),
          buildImage: "forge/test-project:latest",
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

    it("should handle deployment not found", async () => {
      mockDb.deployment.findUnique.mockResolvedValue(null);

      await expect(
        orchestrator.deploy("nonexistent-deploy", "image:latest")
      ).rejects.toThrow("Deployment nonexistent-deploy not found");
    });

    it("should handle health check failure", async () => {
      mockRuntime.waitForHealthy.mockRejectedValue(new Error("Health check timeout"));

      await expect(
        orchestrator.deploy("deploy-123", "image:latest")
      ).rejects.toThrow("Deployment failed: Container failed health check");

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

    it("should use custom health check timeout", async () => {
      await orchestrator.deploy("deploy-123", "image:latest", {
        healthCheckTimeout: 180_000,
      });

      expect(mockRuntime.waitForHealthy).toHaveBeenCalledWith("docker-container-abc", {
        timeout: 180_000,
      });
    });
  });

  describe("ensureNetwork", () => {
    it("should skip creating network if it exists", async () => {
      mockRuntime.listNetworks.mockResolvedValue([
        { id: "network-123", name: "forge-project-project-456" },
      ]);

      // Access private method for testing
      await (orchestrator as any).ensureNetwork("project-456", "test-project");

      expect(mockRuntime.createNetwork).not.toHaveBeenCalled();
    });

    it("should create network if it does not exist", async () => {
      mockRuntime.listNetworks.mockResolvedValue([]);

      await (orchestrator as any).ensureNetwork("project-456", "test-project");

      expect(mockRuntime.createNetwork).toHaveBeenCalledWith({
        name: "forge-project-project-456",
        driver: "bridge",
        internal: false,
        attachable: true,
        labels: {
          "forge.managed": "true",
          "forge.projectId": "project-456",
          "forge.projectName": "test-project",
          "forge.type": "project-network",
        },
      });
    });
  });

  describe("ensureVolumes", () => {
    it("should skip volume creation for bind mounts", async () => {
      const volumes = [
        { mountPath: "/host/path", hostPath: "/local/path", mode: "RW" },
      ];

      const result = await (orchestrator as any).ensureVolumes(volumes, "project-456");

      expect(result.get("/host/path")).toBe("/local/path");
      expect(mockRuntime.createVolume).not.toHaveBeenCalled();
    });

    it("should create named volumes", async () => {
      const volumes = [{ mountPath: "/data", mode: "RW" }];
      mockRuntime.listVolumes.mockResolvedValue([]);

      const result = await (orchestrator as any).ensureVolumes(volumes, "project-456");

      expect(mockRuntime.createVolume).toHaveBeenCalledWith({
        name: "forge-volume-data-project-456",
        driver: "local",
        labels: {
          "forge.managed": "true",
          "forge.projectId": "project-456",
          "forge.type": "project-volume",
        },
      });
      expect(result.get("/data")).toBe("forge-volume-data-project-456");
    });

    it("should use custom volume name if provided", async () => {
      const volumes = [
        { mountPath: "/data", volumeName: "custom-volume", mode: "RW" },
      ];
      mockRuntime.listVolumes.mockResolvedValue([]);

      const result = await (orchestrator as any).ensureVolumes(volumes, "project-456");

      expect(result.get("/data")).toBe("custom-volume");
    });
  });

  describe("parseTimeToInt", () => {
    it("should parse time strings correctly", () => {
      expect((orchestrator as any).parseTimeToInt("30s")).toBe(30);
      expect((orchestrator as any).parseTimeToInt("5m")).toBe(300);
      expect((orchestrator as any).parseTimeToInt("2h")).toBe(7200);
      expect((orchestrator as any).parseTimeToInt("10")).toBe(10);
      expect((orchestrator as any).parseTimeToInt(undefined)).toBeUndefined();
    });
  });

  describe("parseMemoryToBytes", () => {
    it("should parse memory strings correctly", () => {
      expect((orchestrator as any).parseMemoryToBytes("512m")).toBe(BigInt(536870912));
      expect((orchestrator as any).parseMemoryToBytes("1g")).toBe(BigInt(1073741824));
      expect((orchestrator as any).parseMemoryToBytes("1024k")).toBe(BigInt(1048576));
      expect((orchestrator as any).parseMemoryToBytes("1024")).toBe(BigInt(1024));
      expect((orchestrator as any).parseMemoryToBytes(undefined)).toBeUndefined();
    });
  });

  describe("getHealthCheckConfig", () => {
    it("should return explicit health check from config", () => {
      const project = {
        id: "project-123",
        name: "test",
        config: {
          healthCheck: {
            test: ["CMD", "curl", "-f", "http://localhost:8080/ping"],
            interval: "5s",
            timeout: "3s",
            retries: 5,
            startPeriod: "10s",
          },
        },
      };

      const result = (orchestrator as any).getHealthCheckConfig(project);

      expect(result).toEqual({
        test: ["CMD", "curl", "-f", "http://localhost:8080/ping"],
        interval: "5s",
        timeout: "3s",
        retries: 5,
        startPeriod: "10s",
      });
    });

    it("should derive health check from port if not specified", () => {
      const project = {
        id: "project-123",
        name: "test",
        config: { port: 8080 },
      };

      const result = (orchestrator as any).getHealthCheckConfig(project);

      expect(result).toEqual({
        test: ["CMD", "curl", "-f", "http://localhost:8080/health"],
        interval: "10s",
        timeout: "5s",
        retries: 3,
        startPeriod: "30s",
      });
    });

    it("should use default port 3000 if not specified", () => {
      const project = {
        id: "project-123",
        name: "test",
        config: {},
      };

      const result = (orchestrator as any).getHealthCheckConfig(project);

      expect(result.test).toContain("http://localhost:3000/health");
    });
  });
});
