import { describe, it, expect, beforeEach, vi } from "vitest";
import { RecreateStrategy } from "../../strategies/recreate.strategy";
import {
  createMockLogger,
  createMockLifecycle,
  createMockContext,
  createMockManagedContainer,
  resetFixtureCounters,
} from "../fixtures";

describe("RecreateStrategy", () => {
  let strategy: RecreateStrategy;
  let lifecycle: ReturnType<typeof createMockLifecycle>;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    resetFixtureCounters();
    lifecycle = createMockLifecycle();
    logger = createMockLogger();
    strategy = new RecreateStrategy(lifecycle, logger);
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
      const context = createMockContext({ replicas: 2, existingContainerIds: [] });

      const result = await strategy.execute(context);

      expect(result.success).toBe(true);
      expect(result.containers).toHaveLength(2);
      expect(result.removedContainerIds).toHaveLength(0);
      expect(lifecycle.createContainer).toHaveBeenCalledTimes(2);
      expect(lifecycle.startContainer).toHaveBeenCalledTimes(2);
      expect(lifecycle.waitForHealthy).toHaveBeenCalledTimes(2);
    });

    it("does not call stopAndRemove when no existing containers", async () => {
      const context = createMockContext({ replicas: 1, existingContainerIds: [] });

      await strategy.execute(context);

      expect(lifecycle.stopAndRemoveWithContext).not.toHaveBeenCalled();
    });
  });

  describe("execute - with existing containers", () => {
    it("stops all existing containers before creating new ones", async () => {
      const executionOrder: string[] = [];

      vi.mocked(lifecycle.stopAndRemoveWithContext).mockImplementation(() => {
        executionOrder.push("stop-old");
        return Promise.resolve();
      });
      vi.mocked(lifecycle.createContainer).mockImplementation(() => {
        executionOrder.push("create-new");
        return Promise.resolve(createMockManagedContainer());
      });

      const context = createMockContext({
        replicas: 1,
        existingContainerIds: ["old-1"],
      });

      await strategy.execute(context);

      const lastStopIndex = executionOrder.lastIndexOf("stop-old");
      const firstCreateIndex = executionOrder.indexOf("create-new");
      expect(lastStopIndex).toBeLessThan(firstCreateIndex);
    });

    it("includes old container IDs in removedContainerIds", async () => {
      const context = createMockContext({
        replicas: 1,
        existingContainerIds: ["old-1", "old-2"],
      });

      const result = await strategy.execute(context);

      expect(result.success).toBe(true);
      expect(result.removedContainerIds).toEqual(["old-1", "old-2"]);
    });

    it("continues when stopping an old container fails", async () => {
      vi.mocked(lifecycle.stopAndRemoveWithContext)
        .mockRejectedValueOnce(new Error("already gone"))
        .mockResolvedValueOnce(undefined);

      const context = createMockContext({
        replicas: 1,
        existingContainerIds: ["old-1", "old-2"],
      });

      const result = await strategy.execute(context);

      expect(result.success).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        "Failed to stop existing container — continuing",
        expect.objectContaining({ containerId: "old-1" })
      );
    });
  });

  describe("execute - health check failure", () => {
    it("cleans up all new containers and returns error", async () => {
      vi.mocked(lifecycle.waitForHealthy).mockResolvedValue(false);

      const context = createMockContext({ replicas: 2, existingContainerIds: [] });
      const result = await strategy.execute(context);

      expect(result.success).toBe(false);
      expect(result.containers).toHaveLength(0);
      expect(result.error).toContain("failed health check");
      expect(lifecycle.stopAndRemoveWithContext).toHaveBeenCalledTimes(2);
    });
  });

  describe("execute - strategy error", () => {
    it("cleans up all deployed containers in catch block", async () => {
      let callCount = 0;
      vi.mocked(lifecycle.createContainer).mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(new Error("Unexpected error"));
        }
        return Promise.resolve(createMockManagedContainer());
      });

      const context = createMockContext({
        replicas: 3,
        existingContainerIds: ["old-1"],
      });

      const result = await strategy.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unexpected error");
      expect(result.containers).toHaveLength(0);
      expect(lifecycle.stopAndRemoveWithContext).toHaveBeenCalled();
    });
  });
});
