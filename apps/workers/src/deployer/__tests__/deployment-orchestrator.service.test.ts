/**
 * Tests for DeploymentOrchestrator service
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockDb,
  mockLogger,
  mockStrategyRegistry,
  mockLifecycle,
  mockProxyIntegration,
  getDatabaseClientMock,
} = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const mockStrategy = {
    strategyName: "ROLLING" as const,
    execute: vi.fn(),
    validate: vi.fn(),
  };

  const mockStrategyRegistry = {
    register: vi.fn(),
    get: vi.fn(() => mockStrategy),
    getAll: vi.fn(() => [mockStrategy]),
  };

  const mockLifecycle = {
    createContainer: vi.fn(),
    startContainer: vi.fn(),
    waitForHealthy: vi.fn(),
    stopAndRemoveWithContext: vi.fn(),
  };

  const mockProxyIntegration = {
    onContainerDeployed: vi.fn(),
    onContainerRemoved: vi.fn(),
  };

  const getDatabaseClientMock = vi.fn(() => mockDb);

  const mockDb = {
    deployment: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    project: {
      update: vi.fn(),
    },
    container: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    domain: {
      findMany: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
    },
    serviceProjectAccess: {
      findMany: vi.fn(),
    },
    deploymentUrl: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  return {
    mockDb,
    mockLogger,
    mockStrategyRegistry,
    mockLifecycle,
    mockProxyIntegration,
    getDatabaseClientMock,
  };
});

vi.mock("@forge/database", () => ({
  getDatabaseClient: getDatabaseClientMock,
}));

vi.mock("@forge/deploy", () => ({
  createDefaultStrategyRegistry: vi.fn(() => mockStrategyRegistry),
  ContainerLifecycle: vi.fn(),
}));

vi.mock("@forge/service-catalog", () => ({
  resolveServiceEnvVars: vi.fn(() => ({ envVars: {}, warnings: [] })),
}));

vi.mock("@forge/security", () => ({
  decrypt: vi.fn((val: string) => val),
}));

vi.mock("@forge/docker", () => ({
  generateNetworkName: vi.fn((id: string) => `forge-project-${id}`),
  DockerRuntime: vi.fn(),
}));

import { DeploymentOrchestrator } from "../deployment-orchestrator.service.js";

describe("DeploymentOrchestrator", () => {
  let orchestrator: DeploymentOrchestrator;
  const encryptionKey = "test-encryption-key-32bytes!!";

  const mockDeployment = {
    id: "deploy-123",
    version: 1,
    strategy: undefined,
    activeEnvironment: null,
    canaryPercentage: null,
    project: {
      id: "project-456",
      name: "test-project",
      config: {
        port: 3000,
        runtime: {
          env: { NODE_ENV: "production" },
          port: 3000,
        },
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

    // Setup default mock behaviors
    mockDb.deployment.findUnique.mockResolvedValue(mockDeployment);
    mockDb.deployment.update.mockResolvedValue({});
    mockDb.project.update.mockResolvedValue({});
    mockDb.container.updateMany.mockResolvedValue({ count: 0 });
    mockDb.container.findMany.mockResolvedValue([]);
    mockDb.domain.findMany.mockResolvedValue([]);
    mockDb.service.findMany.mockResolvedValue([]);
    mockDb.serviceProjectAccess.findMany.mockResolvedValue([]);
    mockDb.deploymentUrl.create.mockResolvedValue({});

    // Default: strategy validates successfully
    mockStrategyRegistry.get().validate.mockReturnValue({ valid: true });

    // Default: strategy execution succeeds
    mockStrategyRegistry.get().execute.mockResolvedValue({
      success: true,
      containers: [mockContainer],
      removedContainerIds: [],
      duration: 5000,
    });

    // Default: proxy returns URLs
    mockProxyIntegration.onContainerDeployed.mockResolvedValue({
      urls: ["http://test-project.local"],
    });

    // Default: transaction passes through to callback
    mockDb.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        deployment: {
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        project: { update: vi.fn().mockResolvedValue({}) },
        container: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      };
      return await callback(tx);
    });

    orchestrator = new DeploymentOrchestrator(
      mockDb as any,
      mockStrategyRegistry as any,
      mockLifecycle as any,
      mockLogger as any,
      mockProxyIntegration as any,
      encryptionKey
    );
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

      // Verify strategy was executed
      expect(mockStrategyRegistry.get("ROLLING").execute).toHaveBeenCalled();

      // Verify proxy was notified
      expect(mockProxyIntegration.onContainerDeployed).toHaveBeenCalled();
    });

    it("should handle deployment not found", async () => {
      mockDb.deployment.findUnique.mockResolvedValue(null);

      await expect(orchestrator.deploy("nonexistent-deploy", "image:latest")).rejects.toThrow(
        "Deployment nonexistent-deploy not found"
      );
    });

    it("should handle health check failure (strategy returns failure)", async () => {
      mockStrategyRegistry.get().execute.mockResolvedValue({
        success: false,
        containers: [],
        removedContainerIds: [],
        duration: 5000,
        error: "Container failed health check",
      });

      // Setup failure path mocks
      mockDb.deployment.findUnique
        .mockResolvedValueOnce(mockDeployment) // initial lookup
        .mockResolvedValueOnce({
          ...mockDeployment,
          containers: [{ containerId: "docker-container-abc", status: "RUNNING" }],
        }); // failure cleanup lookup

      await expect(orchestrator.deploy("deploy-123", "image:latest")).rejects.toThrow(
        "Deployment failed: Container failed health check"
      );

      // Verify lifecycle cleanup was called
      expect(mockLifecycle.stopAndRemoveWithContext).toHaveBeenCalledWith(
        "docker-container-abc",
        "project-456",
        "deploy-123",
        "test-project"
      );

      // Verify deployment was marked as FAILED via transaction
      expect(mockDb.$transaction).toHaveBeenCalled();
    });

    it("should use progress callback", async () => {
      const progressCallback = vi.fn();

      await orchestrator.deploy("deploy-123", "image:latest", { progressCallback });

      // Verify strategy received an adapted progress callback
      expect(mockStrategyRegistry.get("ROLLING").execute).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Function)
      );
    });
  });

  describe("handleFailure", () => {
    it("should mark deployment as FAILED and clean up containers", async () => {
      mockDb.deployment.findUnique.mockResolvedValue({
        id: "deploy-123",
        containers: [{ containerId: "docker-container-abc", status: "RUNNING" }],
        project: { id: "project-456", name: "test-project" },
      });

      await orchestrator.handleFailure("deploy-123", "Container failed health check");

      // Verify lifecycle cleanup
      expect(mockLifecycle.stopAndRemoveWithContext).toHaveBeenCalledWith(
        "docker-container-abc",
        "project-456",
        "deploy-123",
        "test-project"
      );

      // Verify transaction was called for atomic DB update
      expect(mockDb.$transaction).toHaveBeenCalled();
    });

    it("should handle missing deployment gracefully", async () => {
      mockDb.deployment.findUnique.mockResolvedValue(null);

      await orchestrator.handleFailure("deploy-123", "Unknown error");

      // Should not throw, should just log and skip cleanup
      expect(mockLifecycle.stopAndRemoveWithContext).not.toHaveBeenCalled();
    });
  });
});
