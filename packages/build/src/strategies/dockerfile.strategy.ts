/**
 * Dockerfile build strategy
 * Detects projects with a Dockerfile and uses it for building
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { EventEmitter } from "eventemitter3";
import type {
  IBuildStrategy,
  BuildContext,
  DetectionResult,
  BuildResult,
  BuildConfig,
} from "../interfaces/strategy.js";
import type { BuildProgressEvent } from "../interfaces/strategy.js";
import { BuildValidationError } from "../errors.js";

/**
 * Priority 0 - checks for existing Dockerfile first
 */
export class DockerfileBuildStrategy implements IBuildStrategy {
  readonly name = "dockerfile";

  async detect(context: BuildContext): Promise<DetectionResult> {
    const dockerfilePath = path.join(context.sourceDir, "Dockerfile");

    try {
      await fs.access(dockerfilePath);
      return {
        detected: true,
        framework: "docker",
        confidence: 1, // Highest confidence - user explicitly provided Dockerfile
        discoveredScripts: {
          available: [],
          missing: [],
          source: "Dockerfile",
          sourcePath: dockerfilePath,
        },
      };
    } catch {
      return { detected: false, confidence: 0 };
    }
  }

  async build(
    context: BuildContext,
    config?: BuildConfig,
    emitter?: EventEmitter
  ): Promise<BuildResult> {
    const startTime = Date.now();
    const dockerfilePath = path.join(context.sourceDir, config?.dockerfile || "Dockerfile");

    emitter?.emit("progress", {
      type: "stage",
      message: "Starting Docker build...",
      timestamp: new Date(),
      stage: "init",
    } as BuildProgressEvent);

    // Validate Dockerfile exists
    try {
      await fs.access(dockerfilePath);
      emitter?.emit("progress", {
        type: "log",
        message: `Dockerfile found at ${dockerfilePath}`,
        timestamp: new Date(),
      } as BuildProgressEvent);
    } catch {
      const error = `Dockerfile not found at ${dockerfilePath}`;
      emitter?.emit("progress", {
        type: "error",
        message: error,
        timestamp: new Date(),
      } as BuildProgressEvent);
      throw new BuildValidationError(error);
    }

    emitter?.emit("progress", {
      type: "complete",
      message: "Build completed (stub implementation - Sprint 3 will build actual image)",
      timestamp: new Date(),
      progress: 100,
    } as BuildProgressEvent);

    return {
      success: true,
      logs: `Dockerfile build stub for ${context.projectId}`,
      duration: Date.now() - startTime,
    };
  }

  getDefaultConfig(): BuildConfig {
    return {
      dockerfile: "Dockerfile",
    };
  }

  validateConfig(config: BuildConfig): { valid: boolean; errors?: string[] } {
    if (!config.dockerfile) {
      return { valid: false, errors: ["dockerfile path is required"] };
    }
    return { valid: true };
  }
}
