/**
 * Build strategy registry tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  BuildStrategyRegistry,
  getBuildStrategyRegistry,
  resetBuildStrategyRegistry,
} from "../index.js";
import type {
  BuildContext,
  DetectionResult,
  BuildResult,
  BuildConfig,
} from "../interfaces/strategy.js";
import type { IBuildStrategy } from "../interfaces/strategy.js";

// Mock strategy for testing
class MockStrategy implements IBuildStrategy {
  readonly name = "mock";
  async detect(_context: BuildContext): Promise<DetectionResult> {
    return Promise.resolve({ detected: true, framework: "Mock", confidence: 0.8 });
  }
  async build(): Promise<BuildResult> {
    return Promise.resolve({ success: true, logs: "", duration: 0 });
  }
  getDefaultConfig(): BuildConfig {
    return {};
  }
  validateConfig(): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }
}

describe("BuildStrategyRegistry", () => {
  let registry: BuildStrategyRegistry;
  let mockContext: BuildContext;

  beforeEach(() => {
    registry = new BuildStrategyRegistry();
    mockContext = {
      projectId: "test-project",
      deploymentId: "test-deployment",
      workDir: "/tmp/build",
      sourceDir: "/tmp/source",
      outputDir: "/tmp/output",
    };
  });

  afterEach(() => {
    resetBuildStrategyRegistry();
  });

  describe("register", () => {
    it("should register a strategy", () => {
      const strategy = new MockStrategy();

      registry.register(strategy);

      expect(registry.has("mock")).toBe(true);
    });

    it("should throw when registering duplicate strategy", () => {
      const strategy = new MockStrategy();

      registry.register(strategy);

      expect(() => registry.register(strategy)).toThrow(
        'Strategy "mock" is already registered'
      );
    });
  });

  describe("get", () => {
    it("should get registered strategy", () => {
      const strategy = new MockStrategy();
      registry.register(strategy);

      const result = registry.get("mock");

      expect(result).toBe(strategy);
    });

    it("should return null for unknown strategy", () => {
      const result = registry.get("unknown");

      expect(result).toBeNull();
    });
  });

  describe("getAll", () => {
    it("should return all registered strategies", () => {
      const strategy1 = new MockStrategy();
      class MockStrategy2 implements IBuildStrategy {
        readonly name = "mock2";
        async detect(): Promise<DetectionResult> {
          return Promise.resolve({ detected: false, confidence: 0 });
        }
        async build(): Promise<BuildResult> {
          return Promise.resolve({ success: true, logs: "", duration: 0 });
        }
        getDefaultConfig(): BuildConfig {
          return {};
        }
        validateConfig(): { valid: boolean; errors?: string[] } {
          return { valid: true };
        }
      }
      const strategy2 = new MockStrategy2() as IBuildStrategy;

      registry.register(strategy1);
      registry.register(strategy2);

      const result = registry.getAll();

      expect(result).toHaveLength(2);
      expect(result.map((s) => s.name)).toEqual(["mock", "mock2"]);
    });
  });

  describe("detect", () => {
    it("should return first detecting strategy", async () => {
      class DetectingStrategy implements IBuildStrategy {
        readonly name = "detecting";
        async detect(): Promise<DetectionResult> {
          return Promise.resolve({ detected: true, framework: "Detecting", confidence: 0.9 });
        }
        async build(): Promise<BuildResult> {
          return Promise.resolve({ success: true, logs: "", duration: 0 });
        }
        getDefaultConfig(): BuildConfig {
          return {};
        }
        validateConfig(): { valid: boolean; errors?: string[] } {
          return { valid: true };
        }
      }
      class NonDetectingStrategy implements IBuildStrategy {
        readonly name = "non-detecting";
        async detect(): Promise<DetectionResult> {
          return Promise.resolve({ detected: false, confidence: 0 });
        }
        async build(): Promise<BuildResult> {
          return Promise.resolve({ success: true, logs: "", duration: 0 });
        }
        getDefaultConfig(): BuildConfig {
          return {};
        }
        validateConfig(): { valid: boolean; errors?: string[] } {
          return { valid: true };
        }
      }

      registry.register(new NonDetectingStrategy() as IBuildStrategy);
      registry.register(new DetectingStrategy() as IBuildStrategy);

      const result = await registry.detect(mockContext);

      expect(result.name).toBe("detecting");
    });

    it("should throw NoStrategyFoundError when no strategy detects", async () => {
      class NonDetectingStrategy implements IBuildStrategy {
        readonly name = "non-detecting";
        async detect(): Promise<DetectionResult> {
          return Promise.resolve({ detected: false, confidence: 0 });
        }
        async build(): Promise<BuildResult> {
          return Promise.resolve({ success: true, logs: "", duration: 0 });
        }
        getDefaultConfig(): BuildConfig {
          return {};
        }
        validateConfig(): { valid: boolean; errors?: string[] } {
          return { valid: true };
        }
      }

      registry.register(new NonDetectingStrategy() as IBuildStrategy);

      await expect(registry.detect(mockContext)).rejects.toThrow("No build strategy available");
    });

    it("should handle errors in strategy detection gracefully", async () => {
      class FailingStrategy implements IBuildStrategy {
        readonly name = "failing";
        async detect(): Promise<DetectionResult> {
          return Promise.reject(new Error("Detection failed"));
        }
        async build(): Promise<BuildResult> {
          return Promise.resolve({ success: true, logs: "", duration: 0 });
        }
        getDefaultConfig(): BuildConfig {
          return {};
        }
        validateConfig(): { valid: boolean; errors?: string[] } {
          return { valid: true };
        }
      }
      class WorkingStrategy implements IBuildStrategy {
        readonly name = "working";
        async detect(): Promise<DetectionResult> {
          return Promise.resolve({ detected: true, framework: "Working", confidence: 0.8 });
        }
        async build(): Promise<BuildResult> {
          return Promise.resolve({ success: true, logs: "", duration: 0 });
        }
        getDefaultConfig(): BuildConfig {
          return {};
        }
        validateConfig(): { valid: boolean; errors?: string[] } {
          return { valid: true };
        }
      }

      registry.register(new FailingStrategy() as IBuildStrategy);
      registry.register(new WorkingStrategy() as IBuildStrategy);

      const result = await registry.detect(mockContext);

      expect(result.name).toBe("working");
    });
  });

  describe("clear", () => {
    it("should clear all strategies", () => {
      const strategy = new MockStrategy();
      registry.register(strategy);

      registry.clear();

      expect(registry.has("mock")).toBe(false);
      expect(registry.getAll()).toHaveLength(0);
    });
  });

  describe("getBuildStrategyRegistry", () => {
    it("should return singleton instance", () => {
      const instance1 = getBuildStrategyRegistry();
      const instance2 = getBuildStrategyRegistry();

      expect(instance1).toBe(instance2);
    });

    it("should reset after calling resetBuildStrategyRegistry", () => {
      const instance1 = getBuildStrategyRegistry();
      resetBuildStrategyRegistry();
      const instance2 = getBuildStrategyRegistry();

      expect(instance1).not.toBe(instance2);
    });
  });
});
