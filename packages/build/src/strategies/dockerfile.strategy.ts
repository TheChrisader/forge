import * as fs from "node:fs/promises";
import * as path from "node:path";
import type {
  IBuildStrategy,
  BuildContext,
  DetectionResult,
  BuildResult as StrategyResult,
  BuildConfig,
  BuildProgressCallback,
} from "../interfaces/strategy.js";
import type { BuildResult as DockerBuildResult } from "@forge/docker";
import { DockerRuntime } from "@forge/docker";
import { ProgressAdapter } from "../utils/progress-adapter.js";
import { BuildValidationError } from "../errors.js";
import { generateImageName } from "../utils/image-name-generator.js";

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
    onProgress?: BuildProgressCallback
  ): Promise<StrategyResult> {
    const startTime = Date.now();
    const dockerfilePath = path.join(context.sourceDir, config?.dockerfile || "Dockerfile");

    const adapter = new ProgressAdapter(onProgress);
    adapter.emitStart("docker-build");

    void onProgress?.({
      type: "stage",
      message: "Starting Docker build...",
      timestamp: new Date(),
      stage: "init",
    });

    try {
      await fs.access(dockerfilePath);
      void onProgress?.({
        type: "log",
        message: `Dockerfile found at ${dockerfilePath}`,
        timestamp: new Date(),
      });
    } catch {
      const error = `Dockerfile not found at ${dockerfilePath}`;
      void onProgress?.({
        type: "error",
        message: error,
        timestamp: new Date(),
      });
      throw new BuildValidationError(error);
    }

    const runtime = new DockerRuntime();

    // NOTE: Build artifact caching requires a database client.
    // To enable caching, extend BuildContext to include a `db` field
    // or provide a getDatabaseClient() function in the build worker.
    //
    // Example caching integration:
    //
    // if (!context.noCache && context.db) {
    //   const cacheService = new BuildCacheService(context.db);
    //   const depKey = await cacheService.computeDependencyKey(context.sourceDir);
    //
    //   if (depKey) {
    //     emitter?.emit("progress", {
    //       type: "log",
    //       message: "Checking for cached dependencies...",
    //       timestamp: new Date(),
    //     } as BuildProgressEvent);
    //
    //     const cachedPath = await cacheService.getCachedArtifact(context.projectId, depKey);
    //
    //     if (cachedPath) {
    //       emitter?.emit("progress", {
    //         type: "log",
    //         message: "Using cached node_modules...",
    //         timestamp: new Date(),
    //       } as BuildProgressEvent);
    //
    //       await cacheService.extractArtifact(
    //         cachedPath,
    //         path.join(context.sourceDir, "node_modules")
    //       );
    //     }
    //   }
    // }

    try {
      const imageTag = generateImageName(context.projectName, context.deploymentId);
      const result: DockerBuildResult = await runtime.buildImage(context.sourceDir, {
        dockerfile: config?.dockerfile,
        tags: [imageTag],
        buildArgs: context.buildArgs,
        pull: true,
        onProgress: adapter.createOnProgressCallback(),
      });

      // NOTE: After successful build, cache node_modules if database client is available
      //
      // if (!context.noCache && context.db && depKey) {
      //   const nodeModulesPath = path.join(context.sourceDir, "node_modules");
      //   try {
      //     await fs.access(nodeModulesPath);
      //     await cacheService.storeArtifact(context.projectId, depKey, nodeModulesPath);
      //
      //     emitter?.emit("progress", {
      //       type: "log",
      //       message: "Cached dependencies for next build",
      //       timestamp: new Date(),
      //     } as BuildProgressEvent);
      //   } catch {
      //     // node_modules doesn't exist - skip caching
      //   }
      // }

      adapter.emitComplete(result.imageId);

      void onProgress?.({
        type: "complete",
        message: `Build complete. Image: ${result.imageId.slice(0, 12)}`,
        timestamp: new Date(),
        progress: 100,
      });

      return {
        success: true,
        image: result.imageId,
        logs: `Built image ${result.imageId.slice(0, 12)}`,
        duration: Date.now() - startTime,
        artifacts:
          result.warnings.length > 0
            ? [{ name: "warnings", path: "build", size: result.warnings.length }]
            : undefined,
      };
    } catch (err) {
      void onProgress?.({
        type: "error",
        message: err instanceof Error ? err.message : "Build failed",
        timestamp: new Date(),
      });
      throw err;
    }
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
