import { describe, it, expect } from "vitest";
import { createDefaultStrategyRegistry } from "../../registry/create-default-registry";
import { createMockLogger, createMockLifecycle } from "../fixtures";
import { RollingStrategy } from "../../strategies/rolling.strategy";
import { RecreateStrategy } from "../../strategies/recreate.strategy";
import { BlueGreenStrategy } from "../../strategies/blue-green.strategy";
import { CanaryStrategy } from "../../strategies/canary.strategy";

describe("createDefaultStrategyRegistry", () => {
  it("registers all four deployment strategies", () => {
    const lifecycle = createMockLifecycle();
    const logger = createMockLogger();
    const registry = createDefaultStrategyRegistry(lifecycle, logger);

    expect(registry.getAll()).toHaveLength(4);
  });

  it("registers strategies with correct types", () => {
    const lifecycle = createMockLifecycle();
    const logger = createMockLogger();
    const registry = createDefaultStrategyRegistry(lifecycle, logger);

    expect(registry.get("ROLLING")).toBeInstanceOf(RollingStrategy);
    expect(registry.get("RECREATE")).toBeInstanceOf(RecreateStrategy);
    expect(registry.get("BLUE_GREEN")).toBeInstanceOf(BlueGreenStrategy);
    expect(registry.get("CANARY")).toBeInstanceOf(CanaryStrategy);
  });
});
