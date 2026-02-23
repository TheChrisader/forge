/**
 * Dockerfile build strategy
 * Detects projects with a Dockerfile and uses it for building
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type {
  IBuildStrategy,
  BuildContext,
  DetectionResult,
  BuildResult,
  BuildConfig,
} from "../interfaces/strategy.js";

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

  async build(context: BuildContext, config?: BuildConfig): Promise<BuildResult> {
    // For Sprint 2, just return success
    // Sprint 3 will implement actual Docker build using context and config
    return Promise.resolve({
      success: true,
      logs: `Dockerfile build stub for ${context.projectId} (Sprint 3: will use config.dockerfile: ${config?.dockerfile})`,
      duration: 0,
    });
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
