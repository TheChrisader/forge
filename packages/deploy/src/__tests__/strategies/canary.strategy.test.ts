import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { CanaryStrategy } from "../../strategies/canary.strategy";
import {
  createMockLogger,
  createMockLifecycle,
  createMockContext,
  createMockManagedContainer,
  resetFixtureCounters,
} from "../fixtures";

describe("CanaryStrategy", () => {
  let strategy: CanaryStrategy;
  let lifecycle: ReturnType<typeof createMockLifecycle>;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    resetFixtureCounters();
    vi.useFakeTimers();
    lifecycle = createMockLifecycle();
    logger = createMockLogger();
    strategy = new CanaryStrategy(lifecycle, logger);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("validate", () => {
    it("returns valid for a complete context with existing containers", () => {
      const context = createMockContext({
        existingContainerIds: ["existing-1"],
      });
      expect(strategy.validate(context)).toEqual({ valid: true });
    });

    it("returns invalid when image is missing", () => {
      const context = createMockContext({
        image: "",
        existingContainerIds: ["existing-1"],
      });
      const result = strategy.validate(context);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Image is required");
    });

    it("returns invalid when projectId is missing", () => {
      const context = createMockContext({
        projectId: "",
        existingContainerIds: ["existing-1"],
      });
      const result = strategy.validate(context);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Project ID is required");
    });

    it("returns invalid when no existing containers", () => {
      const context = createMockContext({
        existingContainerIds: [],
      });
      const result = strategy.validate(context);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Canary strategy requires existing containers to compare against"
      );
    });
  });

  describe("execute - successful canary deployment", () => {
    it("creates a canary container and scales to desired replicas", async () => {
      const context = createMockContext({
        replicas: 3,
        existingContainerIds: ["old-1", "old-2"],
        canaryPercentage: 10,
      });

      // Advance timers to satisfy the while loop (10 -> 30 -> 50 -> 70 -> 90 -> 100)
      const executePromise = strategy.execute(context);

      // Advance through the observation loops
      // The while loop runs: 10 -> 30 -> 50 -> 70 -> 90 -> 100 (breaks at >= 100)
      // Each iteration sleeps CANARY_OBSERVATION_INTERVAL (default 30000ms)
      await vi.advanceTimersByTimeAsync(30_000 * 5);

      const result = await executePromise;

      expect(result.success).toBe(true);
      expect(result.containers.length).toBeGreaterThanOrEqual(1);
      expect(result.removedContainerIds).toEqual(["old-1", "old-2"]);
      expect(lifecycle.createContainer).toHaveBeenCalled();
      expect(lifecycle.waitForHealthy).toHaveBeenCalled();
    });

    it("removes all old containers after canary reaches 100%", async () => {
      const context = createMockContext({
        replicas: 1,
        existingContainerIds: ["old-1"],
        canaryPercentage: 100,
      });

      const executePromise = strategy.execute(context);
      await vi.advanceTimersByTimeAsync(30_000);
      const result = await executePromise;

      expect(result.success).toBe(true);
      expect(result.removedContainerIds).toEqual(["old-1"]);
    });

    it("emits progress through all phases", async () => {
      const context = createMockContext({
        replicas: 1,
        existingContainerIds: ["old-1"],
        canaryPercentage: 100,
      });
      const phases: string[] = [];

      const executePromise = strategy.execute(context, (progress) => {
        phases.push(progress.phase);
      });
      await vi.advanceTimersByTimeAsync(30_000);
      await executePromise;

      expect(phases).toContain("preparing");
      expect(phases).toContain("deploying");
      expect(phases).toContain("verifying");
      expect(phases).toContain("complete");
    });
  });

  describe("execute - canary health check failure", () => {
    it("cleans up canary container immediately", async () => {
      vi.mocked(lifecycle.waitForHealthy).mockResolvedValue(false);

      const context = createMockContext({
        replicas: 1,
        existingContainerIds: ["old-1"],
      });

      const result = await strategy.execute(context);

      expect(result.success).toBe(false);
      expect(result.containers).toHaveLength(0);
      expect(result.error).toContain("Canary container failed health check");
      expect(lifecycle.stopAndRemoveWithContext).toHaveBeenCalledTimes(1);
    });

    it("does not remove old containers on canary failure", async () => {
      vi.mocked(lifecycle.waitForHealthy).mockResolvedValue(false);

      const context = createMockContext({
        replicas: 1,
        existingContainerIds: ["old-1"],
      });

      await strategy.execute(context);

      const removeCalls = vi.mocked(lifecycle.stopAndRemoveWithContext).mock.calls;
      const removedIds = removeCalls.map((call) => call[0]);
      expect(removedIds).not.toContain("old-1");
    });
  });

  describe("execute - strategy error", () => {
    it("cleans up canary container in catch block", async () => {
      vi.mocked(lifecycle.createContainer).mockRejectedValue(new Error("Docker unavailable"));

      const context = createMockContext({
        replicas: 1,
        existingContainerIds: ["old-1"],
      });

      const result = await strategy.execute(context);

      expect(result.success).toBe(false);
      expect(result.containers).toHaveLength(0);
      expect(result.error).toContain("Docker unavailable");
      // No canary was created so nothing to clean up
      expect(lifecycle.stopAndRemoveWithContext).not.toHaveBeenCalled();
    });

    it("cleans up canary container when error occurs after creation", async () => {
      const mockCanary = createMockManagedContainer({
        id: "canary-db",
        containerId: "canary-docker",
      });

      vi.mocked(lifecycle.createContainer).mockResolvedValue(mockCanary);
      vi.mocked(lifecycle.startContainer).mockRejectedValue(new Error("Start failed"));

      const context = createMockContext({
        replicas: 1,
        existingContainerIds: ["old-1"],
      });

      const result = await strategy.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Start failed");
      expect(lifecycle.stopAndRemoveWithContext).toHaveBeenCalledTimes(1);
      expect(vi.mocked(lifecycle.stopAndRemoveWithContext).mock.calls[0][0]).toBe("canary-docker");
    });
  });
});
