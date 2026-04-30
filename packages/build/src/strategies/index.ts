import { getBuildStrategyRegistry } from "../registry.js";
import type { IBuildStrategy } from "../interfaces/strategy.js";
import { DockerfileBuildStrategy } from "./dockerfile.strategy.js";
import { NixpacksBuildStrategy } from "./nixpacks.strategy.js";

/**
 * Register all default build strategies
 * This should be called during application initialization
 */
export function registerDefaultStrategies(): void {
  const registry = getBuildStrategyRegistry();

  if (registry.has("dockerfile")) {
    return;
  }

  registry.register(new DockerfileBuildStrategy());
  // registry.register(new NodeJsBuildStrategy());
  // registry.register(new PythonBuildStrategy());
  // registry.register(new GoBuildStrategy());
  // registry.register(new StaticBuildStrategy());
  registry.register(new NixpacksBuildStrategy());
}

export function getDefaultStrategies(): IBuildStrategy[] {
  return [
    new DockerfileBuildStrategy(),
    // new NodeJsBuildStrategy(),
    // new PythonBuildStrategy(),
    // new GoBuildStrategy(),
    // new StaticBuildStrategy(),
    new NixpacksBuildStrategy(),
  ];
}

export { DockerfileBuildStrategy } from "./dockerfile.strategy.js";
export { NodeJsBuildStrategy } from "./nodejs.strategy.js";
export { PythonBuildStrategy } from "./python.strategy.js";
export { GoBuildStrategy } from "./go.strategy.js";
export { StaticBuildStrategy } from "./static.strategy.js";
export { NixpacksBuildStrategy } from "./nixpacks.strategy.js";
