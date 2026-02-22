import { describe, it, expect, beforeEach, vi } from "vitest";
import { DeploymentService } from "../services/deployment.service.js";
import { ConflictError, NotFoundError, BadRequestError } from "@forge/core";
import { QueueService } from "@forge/queue";
import type { PrismaClient } from "@forge/database";
import type {
  Deployment,
  Project,
  DeploymentStatus,
  DeploymentStrategy,
  ProjectStatus,
} from "@forge/types";

describe("DeploymentService", () => {
  let deploymentService: DeploymentService;
  let mockDb: Partial<PrismaClient>;
  let mockQueueService: Partial<QueueService>;

  const createMockDeployment = (overrides?: Partial<Deployment>): Deployment => ({
    id: "deploy-1",
    projectId: "project-1",
    version: 1,
    status: "PENDING" as DeploymentStatus,
    strategy: "ROLLING" as DeploymentStrategy,
    canRollback: true,
    createdAt: new Date(),
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
    environmentId: null,
    buildStartedAt: null,
    buildCompletedAt: null,
    buildImage: null,
    deployStartedAt: null,
    deployCompletedAt: null,
    blueEnvironmentId: null,
    greenEnvironmentId: null,
    activeEnvironment: null,
    canaryPercentage: null,
    canaryMetrics: null,
    rolledBackAt: null,
    rollbackReason: null,
    error: null,
    parentId: null,
    ...overrides,
  });

  const createMockProject = (overrides?: Partial<Project>): Project => ({
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "test-project",
    status: "ACTIVE" as ProjectStatus,
    teamId: null,
    type: null,
    sourceType: null,
    sourceUrl: null,
    config: {},
    metadata: {},
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    ...overrides,
  });

  beforeEach(() => {
    mockDb = {
      deployment: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      } as any,
      project: {
        findUnique: vi.fn(),
        update: vi.fn(),
      } as any,
      $transaction: vi.fn(),
      $queryRaw: vi.fn(),
    };

    mockQueueService = {
      addJob: vi.fn().mockResolvedValue("job-id"),
    };

    deploymentService = new DeploymentService(
      mockDb as PrismaClient,
      mockQueueService as QueueService
    );
  });

  describe("list", () => {
    it("returns deployments with pagination", async () => {
      const mockDeployments: Deployment[] = [createMockDeployment()];

      vi.mocked(mockDb.deployment!.findMany).mockResolvedValue(mockDeployments);
      vi.mocked(mockDb.deployment!.count).mockResolvedValue(1);

      const result = await deploymentService.list({
        projectId: "project-1",
        page: 1,
        limit: 10,
      });

      expect(result.deployments).toEqual(mockDeployments);
      expect(result.total).toBe(1);
      expect(mockDb.deployment!.findMany).toHaveBeenCalledWith({
        where: { projectId: "project-1" },
        skip: 0,
        take: 10,
        orderBy: { createdAt: "desc" },
      });
    });

    it("filters by status when provided", async () => {
      vi.mocked(mockDb.deployment!.findMany).mockResolvedValue([]);
      vi.mocked(mockDb.deployment!.count).mockResolvedValue(0);

      await deploymentService.list({
        status: "PENDING" as DeploymentStatus,
      });

      expect(mockDb.deployment!.findMany).toHaveBeenCalledWith({
        where: { status: "PENDING" },
        skip: 0,
        take: 10,
        orderBy: { createdAt: "desc" },
      });
    });

    it("throws BadRequestError for invalid status", async () => {
      await expect(
        deploymentService.list({
          status: "INVALID" as DeploymentStatus,
        })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe("getById", () => {
    it("returns deployment when found", async () => {
      const mockDeployment = createMockDeployment({ status: "SUCCEEDED" as DeploymentStatus });

      vi.mocked(mockDb.deployment!.findUnique).mockResolvedValue(mockDeployment);

      const result = await deploymentService.getById("deploy-1");

      expect(result).toEqual(mockDeployment);
    });

    it("returns null when not found", async () => {
      vi.mocked(mockDb.deployment!.findUnique).mockResolvedValue(null);

      const result = await deploymentService.getById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("deploy", () => {
    const projectId = "550e8400-e29b-41d4-a716-446655440000";
    const mockProject = createMockProject();

    it("creates deployment and enqueues build job", async () => {
      const mockDeployment = createMockDeployment();

      vi.mocked(mockDb.$transaction!).mockImplementation(async (callback) => {
        return await callback(mockDb as PrismaClient);
      });

      vi.mocked(mockDb.project!.findUnique).mockResolvedValue(mockProject);
      // First $queryRaw call: lock check
      vi.mocked(mockDb.$queryRaw!).mockResolvedValueOnce([{ acquired: true, has_active: false }]);
      // Second $queryRaw call: max version
      vi.mocked(mockDb.$queryRaw!).mockResolvedValueOnce([{ max_version: 0 }]);
      vi.mocked(mockDb.deployment!.create).mockResolvedValue(mockDeployment);
      vi.mocked(mockDb.project!.update).mockResolvedValue(mockProject);

      const result = await deploymentService.deploy(projectId);

      expect(result).toEqual(mockDeployment);
      expect(mockQueueService.addJob).toHaveBeenCalledWith("build", "build-deployment", {
        deploymentId: "deploy-1",
        projectId,
      });
    });

    it("throws NotFoundError when project does not exist", async () => {
      vi.mocked(mockDb.$transaction!).mockImplementation(async (callback) => {
        return await callback(mockDb as PrismaClient);
      });

      vi.mocked(mockDb.project!.findUnique).mockResolvedValue(null);

      await expect(deploymentService.deploy(projectId)).rejects.toThrow(NotFoundError);
    });

    it("throws ConflictError when lock cannot be acquired (concurrent deployment)", async () => {
      vi.mocked(mockDb.$transaction!).mockImplementation(async (callback) => {
        return await callback(mockDb as PrismaClient);
      });

      vi.mocked(mockDb.project!.findUnique).mockResolvedValue(mockProject);
      vi.mocked(mockDb.$queryRaw!).mockResolvedValue([{ acquired: false, has_active: false }]);

      await expect(deploymentService.deploy(projectId)).rejects.toThrow(ConflictError);
    });

    it("throws ConflictError when project has active deployment", async () => {
      vi.mocked(mockDb.$transaction!).mockImplementation(async (callback) => {
        return await callback(mockDb as PrismaClient);
      });

      vi.mocked(mockDb.project!.findUnique).mockResolvedValue(mockProject);
      vi.mocked(mockDb.$queryRaw!).mockResolvedValue([{ acquired: true, has_active: true }]);

      await expect(deploymentService.deploy(projectId)).rejects.toThrow(ConflictError);
    });

    it("handles P2002 unique constraint on version", async () => {
      const p2002Error = new Error("Unique constraint failed");
      (p2002Error as { code?: string }).code = "P2002";
      (p2002Error as { meta?: { target: string[] } }).meta = { target: ["version"] };

      vi.mocked(mockDb.$transaction!).mockImplementation(async (callback) => {
        return await callback(mockDb as PrismaClient);
      });

      vi.mocked(mockDb.project!.findUnique).mockResolvedValue(mockProject);
      // First $queryRaw call: lock check
      vi.mocked(mockDb.$queryRaw!).mockResolvedValueOnce([{ acquired: true, has_active: false }]);
      // Second $queryRaw call: max version
      vi.mocked(mockDb.$queryRaw!).mockResolvedValueOnce([{ max_version: 0 }]);
      vi.mocked(mockDb.deployment!.create).mockRejectedValue(p2002Error);

      await expect(deploymentService.deploy(projectId, "1")).rejects.toThrow(ConflictError);
    });

    it("best-effort update to FAILED when queue enqueue fails", async () => {
      const mockDeployment = createMockDeployment();
      const failedDeployment = createMockDeployment({ status: "FAILED" as DeploymentStatus });

      vi.mocked(mockDb.$transaction!).mockImplementation(async (callback) => {
        return await callback(mockDb as PrismaClient);
      });

      vi.mocked(mockDb.project!.findUnique).mockResolvedValue(mockProject);
      // First $queryRaw call: lock check
      vi.mocked(mockDb.$queryRaw!).mockResolvedValueOnce([{ acquired: true, has_active: false }]);
      // Second $queryRaw call: max version
      vi.mocked(mockDb.$queryRaw!).mockResolvedValueOnce([{ max_version: 0 }]);
      vi.mocked(mockDb.deployment!.create).mockResolvedValue(mockDeployment);
      vi.mocked(mockDb.project!.update).mockResolvedValue(mockProject);
      vi.mocked(mockDb.deployment!.update).mockResolvedValue(failedDeployment);

      vi.mocked(mockQueueService!.addJob!).mockRejectedValue(new Error("Queue connection failed"));

      await expect(deploymentService.deploy(projectId)).rejects.toThrow(ConflictError);
      expect(mockDb.deployment!.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "deploy-1" },
          data: expect.objectContaining({
            status: "FAILED",
            error: "Failed to enqueue build job",
          }),
        })
      );
    });
  });

  describe("cancel", () => {
    it("cancels PENDING deployment", async () => {
      const mockDeployment = createMockDeployment({ status: "PENDING" as DeploymentStatus });
      const cancelledDeployment = createMockDeployment({ status: "CANCELLED" as DeploymentStatus });

      vi.mocked(mockDb.deployment!.findUnique).mockResolvedValue(mockDeployment);
      vi.mocked(mockDb.deployment!.update).mockResolvedValue(cancelledDeployment);

      await deploymentService.cancel("deploy-1");

      expect(mockDb.deployment!.update).toHaveBeenCalledWith({
        where: { id: "deploy-1" },
        data: { status: "CANCELLED" },
      });
    });

    it("throws NotFoundError for non-existent deployment", async () => {
      vi.mocked(mockDb.deployment!.findUnique).mockResolvedValue(null);

      await expect(deploymentService.cancel("non-existent")).rejects.toThrow(NotFoundError);
    });

    it("throws BadRequestError for non-cancellable status", async () => {
      const mockDeployment = createMockDeployment({ status: "DEPLOYING" as DeploymentStatus });

      vi.mocked(mockDb.deployment!.findUnique).mockResolvedValue(mockDeployment);

      await expect(deploymentService.cancel("deploy-1")).rejects.toThrow(BadRequestError);
    });

    it("throws BadRequestError for COMPLETED deployment", async () => {
      const mockDeployment = createMockDeployment({ status: "SUCCEEDED" as DeploymentStatus });

      vi.mocked(mockDb.deployment!.findUnique).mockResolvedValue(mockDeployment);

      await expect(deploymentService.cancel("deploy-1")).rejects.toThrow(BadRequestError);
    });
  });

  describe("getLogs", () => {
    it("returns logs stub for deployment", async () => {
      const mockDeployment = createMockDeployment({ status: "SUCCEEDED" as DeploymentStatus });

      vi.mocked(mockDb.deployment!.findUnique).mockResolvedValue(mockDeployment);

      const logs = await deploymentService.getLogs("deploy-1");

      expect(logs).toContain("deploy-1");
      expect(logs).toContain("Sprint 4");
    });

    it("throws NotFoundError for non-existent deployment", async () => {
      vi.mocked(mockDb.deployment!.findUnique).mockResolvedValue(null);

      await expect(deploymentService.getLogs("non-existent")).rejects.toThrow(NotFoundError);
    });
  });
});
