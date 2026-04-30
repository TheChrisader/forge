import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrphanDetector } from "../orphan-detector.js";

const { mockRuntime, mockDb } = vi.hoisted(() => {
  const mockRuntime = {
    list: vi.fn(),
    listVolumes: vi.fn(),
    inspect: vi.fn(),
    stop: vi.fn(),
    remove: vi.fn(),
    removeVolume: vi.fn(),
    start: vi.fn(),
  };

  const mockDb = {
    service: {
      findUnique: vi.fn(),
    },
  };

  return { mockRuntime, mockDb };
});

vi.mock("@forge/docker", () => ({
  DockerRuntime: vi.fn().mockImplementation(() => mockRuntime),
}));

vi.mock("@forge/database", () => ({
  getDatabaseClient: vi.fn(() => mockDb),
}));

describe("OrphanDetector", () => {
  let detector: OrphanDetector;

  beforeEach(() => {
    vi.clearAllMocks();
    detector = new OrphanDetector(mockRuntime as any, mockDb as any);
  });

  describe("findOrphanedResources", () => {
    it("should return empty arrays when no containers exist", async () => {
      mockRuntime.list.mockResolvedValue([]);
      mockRuntime.listVolumes.mockResolvedValue([]);

      const result = await detector.findOrphanedResources();

      expect(result.orphanedContainers).toEqual([]);
      expect(result.orphanedVolumes).toEqual([]);
    });

    it("should identify containers belonging to deleted services as orphaned", async () => {
      mockRuntime.list.mockResolvedValue([
        {
          id: "container-1",
          name: "svc-1",
          labels: { "forge.service": "true", "forge.serviceId": "svc-1" },
        },
        {
          id: "container-2",
          name: "svc-2",
          labels: { "forge.service": "true", "forge.serviceId": "svc-2" },
        },
      ]);

      mockRuntime.listVolumes.mockResolvedValue([]);

      // svc-1 is soft-deleted beyond grace period (25 hours ago)
      mockDb.service.findUnique
        .mockResolvedValueOnce({ deletedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
        .mockResolvedValueOnce(null); // svc-2 has no record at all

      const result = await detector.findOrphanedResources();

      expect(result.orphanedContainers).toHaveLength(2);
      expect(result.orphanedContainers[0].serviceId).toBe("svc-1");
      expect(result.orphanedContainers[1].serviceId).toBe("svc-2");
    });

    it("should not mark active services as orphaned", async () => {
      mockRuntime.list.mockResolvedValue([
        {
          id: "container-1",
          name: "svc-1",
          labels: { "forge.service": "true", "forge.serviceId": "svc-1" },
        },
      ]);

      mockRuntime.listVolumes.mockResolvedValue([]);

      mockDb.service.findUnique.mockResolvedValue({ deletedAt: null });

      const result = await detector.findOrphanedResources();

      expect(result.orphanedContainers).toHaveLength(0);
    });

    it("should not mark recently soft-deleted services as orphaned (within grace period)", async () => {
      mockRuntime.list.mockResolvedValue([
        {
          id: "container-1",
          name: "svc-1",
          labels: { "forge.service": "true", "forge.serviceId": "svc-1" },
        },
      ]);

      mockRuntime.listVolumes.mockResolvedValue([]);

      // Deleted 1 hour ago - within 24-hour grace period
      mockDb.service.findUnique.mockResolvedValue({
        deletedAt: new Date(Date.now() - 60 * 60 * 1000),
      });

      const result = await detector.findOrphanedResources();

      expect(result.orphanedContainers).toHaveLength(0);
    });

    it("should skip containers without forge.serviceId label", async () => {
      mockRuntime.list.mockResolvedValue([
        { id: "container-1", name: "other", labels: { "forge.managed": "true" } },
      ]);

      mockRuntime.listVolumes.mockResolvedValue([]);

      const result = await detector.findOrphanedResources();

      expect(result.orphanedContainers).toHaveLength(0);
      expect(mockDb.service.findUnique).not.toHaveBeenCalled();
    });

    it("should identify orphaned volumes by label", async () => {
      mockRuntime.list.mockResolvedValue([]);

      mockRuntime.listVolumes.mockResolvedValue([
        { name: "vol-1", labels: { "forge.serviceId": "deleted-svc" } },
      ]);

      mockDb.service.findUnique.mockResolvedValue(null);

      const result = await detector.findOrphanedResources();

      expect(result.orphanedVolumes).toHaveLength(1);
      expect(result.orphanedVolumes[0].name).toBe("vol-1");
      expect(result.orphanedVolumes[0].type).toBe("volume");
    });

    it("should identify orphaned volumes by name pattern", async () => {
      mockRuntime.list.mockResolvedValue([]);

      mockRuntime.listVolumes.mockResolvedValue([{ name: "forge-svc-data-abc12345", labels: {} }]);

      mockDb.service.findUnique.mockResolvedValue(null);

      const result = await detector.findOrphanedResources();

      expect(result.orphanedVolumes).toHaveLength(1);
      expect(result.orphanedVolumes[0].name).toBe("forge-svc-data-abc12345");
    });

    it("should skip non-Forge volumes", async () => {
      mockRuntime.list.mockResolvedValue([]);

      mockRuntime.listVolumes.mockResolvedValue([{ name: "random-volume", labels: {} }]);

      const result = await detector.findOrphanedResources();

      expect(result.orphanedVolumes).toHaveLength(0);
    });
  });

  describe("cleanupOrphans", () => {
    it("should stop and remove orphaned containers", async () => {
      mockRuntime.list.mockResolvedValue([
        {
          id: "container-1",
          name: "orphan-1",
          labels: { "forge.service": "true", "forge.serviceId": "deleted-svc" },
        },
      ]);
      mockRuntime.listVolumes.mockResolvedValue([]);
      mockDb.service.findUnique.mockResolvedValue(null);

      // Container is running
      mockRuntime.inspect.mockResolvedValue({ state: { running: true } });

      const result = await detector.cleanupOrphans();

      expect(result.cleanedContainers).toBe(1);
      expect(mockRuntime.stop).toHaveBeenCalledWith("orphan-1", { timeout: 10 });
      expect(mockRuntime.remove).toHaveBeenCalledWith("orphan-1", { force: true });
    });

    it("should handle cleanup failure gracefully", async () => {
      mockRuntime.list.mockResolvedValue([
        {
          id: "container-1",
          name: "orphan-1",
          labels: { "forge.service": "true", "forge.serviceId": "deleted-svc" },
        },
      ]);
      mockRuntime.listVolumes.mockResolvedValue([]);
      mockDb.service.findUnique.mockResolvedValue(null);

      mockRuntime.inspect.mockRejectedValue(new Error("not found"));

      const result = await detector.cleanupOrphans();

      // Should not throw, but container not cleaned
      expect(result.cleanedContainers).toBe(0);
    });

    it("should remove orphaned volumes", async () => {
      mockRuntime.list.mockResolvedValue([]);
      mockRuntime.listVolumes.mockResolvedValue([
        { name: "orphan-vol", labels: { "forge.serviceId": "deleted-svc" } },
      ]);
      mockDb.service.findUnique.mockResolvedValue(null);

      const result = await detector.cleanupOrphans();

      expect(result.cleanedVolumes).toBe(1);
      expect(mockRuntime.removeVolume).toHaveBeenCalledWith("orphan-vol");
    });
  });
});
