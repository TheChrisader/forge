/**
 * Build strategy auto-registration
 * Registers all default build strategies
 */

import { getBuildStrategyRegistry } from "../registry.js";
import type { IBuildStrategy } from "../interfaces/strategy.js";
import { DockerfileBuildStrategy } from "./dockerfile.strategy.js";
import { NodeJsBuildStrategy } from "./nodejs.strategy.js";
import { PythonBuildStrategy } from "./python.strategy.js";
import { GoBuildStrategy } from "./go.strategy.js";
import { StaticBuildStrategy } from "./static.strategy.js";

/**
 * Register all default build strategies
 * This should be called during application initialization
 */
export function registerDefaultStrategies(): void {
  const registry = getBuildStrategyRegistry();

  // Don't re-register if already registered
  if (registry.has("dockerfile")) {
    return;
  }

  registry.register(new DockerfileBuildStrategy());
  registry.register(new NodeJsBuildStrategy());
  registry.register(new PythonBuildStrategy());
  registry.register(new GoBuildStrategy());
  registry.register(new StaticBuildStrategy());
}

/**
 * Get all default strategies without registering them
 */
export function getDefaultStrategies(): IBuildStrategy[] {
  return [
    new DockerfileBuildStrategy(),
    new NodeJsBuildStrategy(),
    new PythonBuildStrategy(),
    new GoBuildStrategy(),
    new StaticBuildStrategy(),
  ];
}

// Export individual strategies for direct use
export { DockerfileBuildStrategy } from "./dockerfile.strategy.js";
export { NodeJsBuildStrategy } from "./nodejs.strategy.js";
export { PythonBuildStrategy } from "./python.strategy.js";
export { GoBuildStrategy } from "./go.strategy.js";
export { StaticBuildStrategy } from "./static.strategy.js";
