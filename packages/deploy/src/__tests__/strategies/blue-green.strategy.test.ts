import { describe, it, expect, beforeEach, vi } from "vitest";
import { BlueGreenStrategy } from "../../strategies/blue-green.strategy";
import {
  createMockLogger,
  createMockLifecycle,
  createMockContext,
  resetFixtureCounters,
} from "../fixtures";

describe("BlueGreenStrategy", () => {
  let strategy: BlueGreenStrategy;
  let lifecycle: ReturnType<typeof createMockLifecycle>;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    resetFixtureCounters();
    lifecycle = createMockLifecycle();
    logger = createMockLogger();
    strategy = new BlueGreenStrategy(lifecycle, logger);
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

  describe("execute - fresh deploy (no active environment)", () => {
    it("deploys to BLUE when no active environment is set", async () => {
      const context = createMockContext({
        replicas: 2,
        existingContainerIds: [],
        activeEnvironment: undefined,
      });

      const result = await strategy.execute(context);

      expect(result.success).toBe(true);
      expect(result.activeEnvironment).toBe("BLUE");
      expect(result.containers).toHaveLength(2);
      expect(result.removedContainerIds).toHaveLength(0);
    });

    it("creates, starts, and health-checks all replicas", async () => {
      const context = createMockContext({
        replicas: 3,
        existingContainerIds: [],
      });

      await strategy.execute(context);

      expect(lifecycle.createContainer).toHaveBeenCalledTimes(3);
      expect(lifecycle.startContainer).toHaveBeenCalledTimes(3);
      expect(lifecycle.waitForHealthy).toHaveBeenCalledTimes(3);
    });
  });

  describe("execute - switch BLUE to GREEN", () => {
    it("deploys to GREEN and removes BLUE containers", async () => {
      const context = createMockContext({
        replicas: 2,
        existingContainerIds: ["blue-1", "blue-2"],
        activeEnvironment: "BLUE",
      });

      const result = await strategy.execute(context);

      expect(result.success).toBe(true);
      expect(result.activeEnvironment).toBe("GREEN");
      expect(result.containers).toHaveLength(2);
      expect(result.removedContainerIds).toEqual(["blue-1", "blue-2"]);
    });

    it("removes old containers only after all new ones are healthy", async () => {
      const executionOrder: string[] = [];

      vi.mocked(lifecycle.stopAndRemoveWithContext).mockImplementation(() => {
        executionOrder.push("remove-old");
        return Promise.resolve();
      });
      vi.mocked(lifecycle.waitForHealthy).mockImplementation(() => {
        executionOrder.push("health-check");
        return Promise.resolve(true);
      });

      const context = createMockContext({
        replicas: 1,
        existingContainerIds: ["blue-1"],
        activeEnvironment: "BLUE",
      });

      await strategy.execute(context);

      const lastHealthCheck = executionOrder.lastIndexOf("health-check");
      const firstRemove = executionOrder.indexOf("remove-old");
      expect(firstRemove).toBeGreaterThan(lastHealthCheck);
    });

    it("continues when removing an old container fails", async () => {
      vi.mocked(lifecycle.stopAndRemoveWithContext)
        .mockRejectedValueOnce(new Error("already gone"))
        .mockResolvedValueOnce(undefined);

      const context = createMockContext({
        replicas: 1,
        existingContainerIds: ["blue-1", "blue-2"],
        activeEnvironment: "BLUE",
      });

      const result = await strategy.execute(context);

      expect(result.success).toBe(true);
      // blue-1 removal failed so it's not in removedContainerIds; blue-2 succeeded
      expect(result.removedContainerIds).toEqual(["blue-2"]);
      expect(logger.warn).toHaveBeenCalledWith(
        "Failed to remove old environment container — continuing",
        expect.objectContaining({ containerId: "blue-1" })
      );
    });
  });

  describe("execute - health check failure (rollback)", () => {
    it("cleans up new environment and keeps old environment untouched", async () => {
      vi.mocked(lifecycle.waitForHealthy).mockResolvedValue(false);

      const context = createMockContext({
        replicas: 2,
        existingContainerIds: ["blue-1", "blue-2"],
        activeEnvironment: "BLUE",
      });

      const result = await strategy.execute(context);

      expect(result.success).toBe(false);
      expect(result.containers).toHaveLength(0);
      expect(result.error).toContain("failed health check");
      expect(result.error).toContain("old environment left untouched");

      // New environment containers should be cleaned up
      expect(lifecycle.stopAndRemoveWithContext).toHaveBeenCalledTimes(2);

      // Old containers should NOT be removed
      const removeCalls = vi.mocked(lifecycle.stopAndRemoveWithContext).mock.calls;
      const removedIds = removeCalls.map((call) => call[0]);
      expect(removedIds).not.toContain("blue-1");
      expect(removedIds).not.toContain("blue-2");
    });
  });

  describe("execute - strategy error", () => {
    it("cleans up all new containers in catch block", async () => {
      vi.mocked(lifecycle.createContainer).mockImplementation(() =>
        Promise.reject(new Error("Creation failed"))
      );

      const context = createMockContext({
        replicas: 2,
        existingContainerIds: [],
      });

      const result = await strategy.execute(context);

      expect(result.success).toBe(false);
      expect(result.containers).toHaveLength(0);
      expect(result.error).toContain("Creation failed");
    });
  });

  describe("execute - progress callbacks", () => {
    it("emits progress through preparing, deploying, verifying, and complete phases", async () => {
      const context = createMockContext({
        replicas: 1,
        existingContainerIds: [],
      });
      const phases: string[] = [];

      await strategy.execute(context, (progress) => {
        phases.push(progress.phase);
      });

      expect(phases).toContain("preparing");
      expect(phases).toContain("deploying");
      expect(phases).toContain("verifying");
      expect(phases).toContain("complete");
    });
  });
});
