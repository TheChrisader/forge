/**
 * Build strategy registry
 * Manages registration and detection of build strategies
 */

import type {
  IBuildStrategy,
  IBuildStrategyRegistry,
  BuildContext,
  DetectionResult,
} from "./interfaces/strategy.js";

/**
 * BuildStrategyRegistry manages build strategies
 */
export class BuildStrategyRegistry implements IBuildStrategyRegistry {
  private strategies = new Map<string, IBuildStrategy>();

  register(strategy: IBuildStrategy): void {
    if (this.strategies.has(strategy.name)) {
      throw new Error(`Strategy "${strategy.name}" is already registered`);
    }
    this.strategies.set(strategy.name, strategy);
  }

  getAll(): IBuildStrategy[] {
    return Array.from(this.strategies.values());
  }

  async detect(context: BuildContext): Promise<IBuildStrategy | null> {
    const detections: Array<{ strategy: IBuildStrategy; result: DetectionResult }> = [];

    // Collect ALL successful detections
    for (const strategy of this.strategies.values()) {
      try {
        const result = await strategy.detect(context);
        if (result.detected) {
          detections.push({ strategy, result });
        }
      } catch (error) {
        // Log error but continue trying other strategies
        console.error(
          `Error in strategy "${strategy.name}":`,
          error instanceof Error ? error.message : error
        );
      }
    }

    if (detections.length === 0) return null;

    detections.sort((a, b) => b.result.confidence - a.result.confidence);

    return detections[0].strategy;
  }

  get(name: string): IBuildStrategy | null {
    return this.strategies.get(name) ?? null;
  }

  has(name: string): boolean {
    return this.strategies.has(name);
  }

  clear(): void {
    this.strategies.clear();
  }
}

// Singleton instance
let registryInstance: BuildStrategyRegistry | null = null;

export function getBuildStrategyRegistry(): BuildStrategyRegistry {
  if (!registryInstance) {
    registryInstance = new BuildStrategyRegistry();
  }
  return registryInstance;
}

export function resetBuildStrategyRegistry(): void {
  registryInstance = null;
}
