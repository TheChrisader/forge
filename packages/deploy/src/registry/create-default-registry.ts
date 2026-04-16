import type { ILogger } from "@forge/core";
import { DeploymentStrategyRegistry } from "./strategy-registry";
import { RecreateStrategy } from "../strategies/recreate.strategy";
import { RollingStrategy } from "../strategies/rolling.strategy";
import { BlueGreenStrategy } from "../strategies/blue-green.strategy";
import { CanaryStrategy } from "../strategies/canary.strategy";
import type { IContainerLifecycle } from "../helpers/container-lifecycle";

export function createDefaultStrategyRegistry(
  lifecycle: IContainerLifecycle,
  logger: ILogger
): DeploymentStrategyRegistry {
  const registry = new DeploymentStrategyRegistry();

  registry.register(new RecreateStrategy(lifecycle, logger));
  registry.register(new RollingStrategy(lifecycle, logger));
  registry.register(new BlueGreenStrategy(lifecycle, logger));
  registry.register(new CanaryStrategy(lifecycle, logger));

  return registry;
}
