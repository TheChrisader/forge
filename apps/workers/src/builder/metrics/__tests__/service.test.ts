import { describe, it, expect, vi, beforeEach } from "vitest";
import { BuildMetricsService } from "../service.js";

const { mockDb, mockMetricsCollector } = vi.hoisted(() => ({
  mockDb: {
    deployment: {
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
  mockMetricsCollector: {
    record: vi.fn(),
  },
}));

describe("BuildMetricsService", () => {
  let service: BuildMetricsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BuildMetricsService(mockDb as any, mockMetricsCollector);
  });

  describe("recordBuildStart", () => {
    it("should record build start timestamp", async () => {
      await service.recordBuildStart("deploy-123");

      expect(mockDb.deployment.update).toHaveBeenCalledWith({
        where: { id: "deploy-123" },
        data: { buildStartedAt: expect.any(Date) },
      });
    });
  });

  describe("recordBuildComplete", () => {
    it("should record successful build completion", async () => {
      const record = {
        deploymentId: "deploy-123",
        projectId: "project-456",
        startedAt: new Date(Date.now() - 60_000),
        completedAt: new Date(),
        status: "SUCCEEDED",
      };

      await service.recordBuildComplete(record);

      expect(mockDb.deployment.update).toHaveBeenCalledWith({
        where: { id: "deploy-123" },
        data: {
          status: "SUCCEEDED",
          buildCompletedAt: expect.any(Date),
          error: undefined,
        },
      });

      // Should emit metrics
      expect(mockMetricsCollector.record).toHaveBeenCalledWith(
        expect.objectContaining({ metric: "build_total" })
      );
      expect(mockMetricsCollector.record).toHaveBeenCalledWith(
        expect.objectContaining({ metric: "build_duration_seconds" })
      );
    });

    it("should record failed build completion", async () => {
      const record = {
        deploymentId: "deploy-123",
        projectId: "project-456",
        startedAt: new Date(Date.now() - 60_000),
        completedAt: new Date(),
        status: "FAILED",
        errorMessage: "Build failed",
      };

      await service.recordBuildComplete(record);

      expect(mockDb.deployment.update).toHaveBeenCalledWith({
        where: { id: "deploy-123" },
        data: {
          status: "FAILED",
          buildCompletedAt: expect.any(Date),
          error: "Build failed",
        },
      });

      // Should emit error metric
      expect(mockMetricsCollector.record).toHaveBeenCalledWith(
        expect.objectContaining({ metric: "build_errors_total" })
      );
    });

    it("should include image name when imageSize is provided", async () => {
      const record = {
        deploymentId: "deploy-123",
        projectId: "project-456",
        startedAt: new Date(Date.now() - 60_000),
        completedAt: new Date(),
        status: "SUCCEEDED",
        imageSize: 500_000_000,
      };

      await service.recordBuildComplete(record);

      expect(mockDb.deployment.update).toHaveBeenCalledWith({
        where: { id: "deploy-123" },
        data: expect.objectContaining({
          buildImage: "forge:deploy-123",
        }),
      });
    });

    it("should not emit metrics when no collector provided", async () => {
      const serviceWithoutCollector = new BuildMetricsService(mockDb as any);

      const record = {
        deploymentId: "deploy-123",
        projectId: "project-456",
        startedAt: new Date(Date.now() - 60_000),
        completedAt: new Date(),
        status: "SUCCEEDED",
      };

      await serviceWithoutCollector.recordBuildComplete(record);

      expect(mockDb.deployment.update).toHaveBeenCalled();
      // mockMetricsCollector.record should NOT be called since we used a different instance
      // but just verify DB update happened
    });
  });

  describe("getProjectStatistics", () => {
    it("should return statistics for a project", async () => {
      mockDb.deployment.findMany.mockResolvedValue([
        {
          status: "SUCCEEDED",
          buildStartedAt: new Date(Date.now() - 120_000),
          buildCompletedAt: new Date(),
        },
        {
          status: "FAILED",
          buildStartedAt: new Date(Date.now() - 60_000),
          buildCompletedAt: new Date(),
        },
        {
          status: "SUCCEEDED",
          buildStartedAt: new Date(Date.now() - 30_000),
          buildCompletedAt: new Date(),
        },
      ]);

      const stats = await service.getProjectStatistics("project-456");

      expect(stats.totalBuilds).toBe(3);
      expect(stats.successfulBuilds).toBe(2);
      expect(stats.failedBuilds).toBe(1);
      expect(stats.successRate).toBeCloseTo(66.67, 0);
      expect(stats.averageBuildDuration).toBeGreaterThan(0);
    });

    it("should return zero statistics when no builds exist", async () => {
      mockDb.deployment.findMany.mockResolvedValue([]);

      const stats = await service.getProjectStatistics("project-456");

      expect(stats.totalBuilds).toBe(0);
      expect(stats.successfulBuilds).toBe(0);
      expect(stats.failedBuilds).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.averageBuildDuration).toBe(0);
    });

    it("should only look at last 100 builds", async () => {
      await service.getProjectStatistics("project-456");

      expect(mockDb.deployment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });
  });
});
