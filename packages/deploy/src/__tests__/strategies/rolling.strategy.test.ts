import { describe, it, expect, beforeEach, vi } from "vitest";
import { RollingStrategy } from "../../strategies/rolling.strategy";
import {
  createMockLogger,
  createMockLifecycle,
  createMockContext,
  createMockManagedContainer,
  resetFixtureCounters,
} from "../fixtures";

describe("RollingStrategy", () => {
  let strategy: RollingStrategy;
  let lifecycle: ReturnType<typeof createMockLifecycle>;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    resetFixtureCounters();
    lifecycle = createMockLifecycle();
    logger = createMockLogger();
    strategy = new RollingStrategy(lifecycle, logger);
  });

  describe("validate", () => {
    it("returns valid for a complete context", () => {
      const context = createMockContext();
      expect(strategy.validate(context)).toEqual({ valid: true });
    });

    it("returns invalid when image is missing", () => {
      const context = createMockContext({ image: "" });
      const result = strategy.validate(context);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Image is required");
    });

    it("returns invalid when projectId is missing", () => {
      const context = createMockContext({ projectId: "" });
      const result = strategy.validate(context);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Project ID is required");
    });
  });

  describe("execute - fresh deploy (no existing containers)", () => {
    it("creates, starts, and health-checks all replicas", async () => {
      const context = createMockContext({ replicas: 3, existingContainerIds: [] });

      const result = await strategy.execute(context);

      expect(result.success).toBe(true);
      expect(result.containers).toHaveLength(3);
      expect(result.removedContainerIds).toHaveLength(0);
      expect(lifecycle.createContainer).toHaveBeenCalledTimes(3);
      expect(lifecycle.startContainer).toHaveBeenCalledTimes(3);
      expect(lifecycle.waitForHealthy).toHaveBeenCalledTimes(3);
    });

    it("returns containers with correct IDs", async () => {
      const mockContainer = createMockManagedContainer({
        id: "db-abc",
        containerId: "docker-xyz",
      });
      vi.mocked(lifecycle.createContainer).mockResolvedValue(mockContainer);

      const context = createMockContext({ replicas: 1, existingContainerIds: [] });
      const result = await strategy.execute(context);

      expect(result.containers[0]).toEqual({
        id: "db-abc",
        containerId: "docker-xyz",
      });
    });

    it("emits progress through all phases", async () => {
      const context = createMockContext({ replicas: 1, existingContainerIds: [] });
      const progressCalls: Array<{ phase: string; percentage: number }> = [];

      await strategy.execute(context, (progress) => {
        progressCalls.push({ phase: progress.phase, percentage: progress.percentage });
      });

      const phases = progressCalls.map((c) => c.phase);
      expect(phases).toContain("deploying");
      expect(phases).toContain("verifying");
      expect(phases).toContain("complete");
    });

    it("returns positive duration", async () => {
      const context = createMockContext({ replicas: 1, existingContainerIds: [] });
      const result = await strategy.execute(context);

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe("execute - rolling replace (existing containers)", () => {
    it("replaces containers one-by-one", async () => {
      const existingIds = ["old-docker-1", "old-docker-2"];
      const context = createMockContext({
        replicas: 2,
        existingContainerIds: existingIds,
      });

      const result = await strategy.execute(context);

      expect(result.success).toBe(true);
      expect(result.containers).toHaveLength(2);
      expect(result.removedContainerIds).toHaveLength(2);
      expect(lifecycle.stopAndRemoveWithContext).toHaveBeenCalledTimes(2);
    });

    it("removes old containers only after new ones are healthy", async () => {
      const executionOrder: string[] = [];

      vi.mocked(lifecycle.createContainer).mockImplementation(() => {
        executionOrder.push("create");
        return Promise.resolve(createMockManagedContainer());
      });
      vi.mocked(lifecycle.waitForHealthy).mockImplementation(() => {
        executionOrder.push("health-check");
        return Promise.resolve(true);
      });
      vi.mocked(lifecycle.stopAndRemoveWithContext).mockImplementation(() => {
        executionOrder.push("remove-old");
        return Promise.resolve();
      });

      const context = createMockContext({
        replicas: 1,
        existingContainerIds: ["old-1"],
      });

      await strategy.execute(context);

      for (let i = 0; i < executionOrder.length; i++) {
        const idx = executionOrder.indexOf("create", i);
        const healthIdx = executionOrder.indexOf("health-check", idx);
        const removeIdx = executionOrder.indexOf("remove-old", healthIdx);
        expect(removeIdx).toBeGreaterThan(healthIdx);
        break;
      }
    });
  });

  describe("execute - health check failure during fresh deploy", () => {
    it("cleans up the failed container and returns error", async () => {
      vi.mocked(lifecycle.waitForHealthy).mockResolvedValue(false);

      const context = createMockContext({ replicas: 3, existingContainerIds: [] });
      const result = await strategy.execute(context);

      expect(result.success).toBe(false);
      expect(result.containers).toHaveLength(0);
      expect(result.error).toContain("failed health check");
      expect(lifecycle.stopAndRemoveWithContext).toHaveBeenCalledTimes(1);
    });
  });

  describe("execute - health check failure during rolling replace", () => {
    it("keeps previously replaced containers running", async () => {
      let callCount = 0;
      vi.mocked(lifecycle.waitForHealthy).mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount <= 1);
      });

      const context = createMockContext({
        replicas: 3,
        existingContainerIds: ["old-1", "old-2", "old-3"],
      });

      const result = await strategy.execute(context);

      expect(result.success).toBe(false);
      expect(result.containers).toHaveLength(1);
      expect(result.error).toContain("1 container(s) were successfully replaced");
    });
  });

  describe("execute - container creation failure", () => {
    it("returns error with containers deployed so far", async () => {
      let callCount = 0;
      vi.mocked(lifecycle.createContainer).mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(new Error("Docker daemon unavailable"));
        }
        return Promise.resolve(createMockManagedContainer());
      });

      const context = createMockContext({
        replicas: 3,
        existingContainerIds: ["old-1", "old-2", "old-3"],
      });

      const result = await strategy.execute(context);

      expect(result.success).toBe(false);
      expect(result.containers).toHaveLength(1);
      expect(result.error).toContain("Docker daemon unavailable");
    });
  });
});
