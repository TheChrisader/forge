import { describe, it, expect, beforeEach } from "vitest";
import { DeploymentStrategyRegistry } from "../../registry/strategy-registry";
import { RollingStrategy } from "../../strategies/rolling.strategy";
import { RecreateStrategy } from "../../strategies/recreate.strategy";
import { createMockLogger, createMockLifecycle } from "../fixtures";

describe("DeploymentStrategyRegistry", () => {
  let registry: DeploymentStrategyRegistry;

  beforeEach(() => {
    registry = new DeploymentStrategyRegistry();
  });

  describe("register", () => {
    it("adds a strategy to the registry", () => {
      const lifecycle = createMockLifecycle();
      const logger = createMockLogger();
      const strategy = new RollingStrategy(lifecycle, logger);

      registry.register(strategy);

      expect(registry.get("ROLLING")).toBe(strategy);
    });

    it("throws when registering a duplicate strategy name", () => {
      const lifecycle = createMockLifecycle();
      const logger = createMockLogger();

      const strategy1 = new RollingStrategy(lifecycle, logger);
      const strategy2 = new RollingStrategy(lifecycle, logger);

      registry.register(strategy1);

      expect(() => registry.register(strategy2)).toThrow(
        'Strategy "ROLLING" is already registered'
      );
    });
  });

  describe("get", () => {
    it("returns the strategy by name", () => {
      const lifecycle = createMockLifecycle();
      const logger = createMockLogger();
      const strategy = new RollingStrategy(lifecycle, logger);

      registry.register(strategy);

      expect(registry.get("ROLLING")).toBe(strategy);
    });

    it("returns null for an unknown strategy name", () => {
      expect(registry.get("NONEXISTENT")).toBeNull();
    });
  });

  describe("getAll", () => {
    it("returns all registered strategies", () => {
      const lifecycle = createMockLifecycle();
      const logger = createMockLogger();

      registry.register(new RollingStrategy(lifecycle, logger));
      registry.register(new RecreateStrategy(lifecycle, logger));

      const all = registry.getAll();

      expect(all).toHaveLength(2);
      expect(all.map((s) => s.strategyName)).toContain("ROLLING");
      expect(all.map((s) => s.strategyName)).toContain("RECREATE");
    });

    it("returns empty array when no strategies are registered", () => {
      expect(registry.getAll()).toEqual([]);
    });
  });
});
