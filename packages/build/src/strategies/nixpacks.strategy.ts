/**
 * Nixpacks build strategy
 * Detects projects with nixpacks.toml or generic projects and uses nixpacks for zero-config builds
 * Supports 20+ languages/frameworks via auto-detection
 */

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
import { DockerRuntime } from "@forge/docker";
import { BuildValidationError } from "../errors.js";
import { ProgressAdapter } from "../utils/progress-adapter.js";
import { generateImageName } from "../utils/image-name-generator.js";

// Use the locally-built nixpacks-builder image from worker init
// This image has nixpacks pre-installed and uses the host Docker daemon
const NIXPACKS_IMAGE = "forge/nixpacks-builder:local";
const NIXPACKS_CONFIDENCE_WITH_CONFIG = 0.9;
const NIXPACKS_CONFIDENCE_GENERIC = 0.75;

export class NixpacksBuildStrategy implements IBuildStrategy {
  readonly name = "nixpacks";

  async detect(context: BuildContext): Promise<DetectionResult> {
    const nixpacksTomlPath = path.join(context.sourceDir, "nixpacks.toml");

    try {
      await fs.access(nixpacksTomlPath);
      return {
        detected: true,
        framework: "nixpacks",
        confidence: NIXPACKS_CONFIDENCE_WITH_CONFIG,
        discoveredScripts: {
          available: [],
          missing: [],
          source: "nixpacks.toml",
          sourcePath: nixpacksTomlPath,
        },
      };
    } catch {
      const hasProjectFiles = await this.hasGenericProjectFiles(context.sourceDir);
      if (hasProjectFiles) {
        return {
          detected: true,
          framework: "generic",
          confidence: NIXPACKS_CONFIDENCE_GENERIC,
          discoveredScripts: {
            available: [],
            missing: [],
            source: "generic-detection",
            sourcePath: context.sourceDir,
          },
        };
      }
      return { detected: false, confidence: 0 };
    }
  }

  private async hasGenericProjectFiles(sourceDir: string): Promise<boolean> {
    const indicators = [
      "package.json",
      "requirements.txt",
      "go.mod",
      "Cargo.toml",
      "pom.xml",
      "build.gradle",
      "composer.json",
      "Gemfile",
      "index.html",
      "index.js",
    ];

    for (const file of indicators) {
      try {
        await fs.access(path.join(sourceDir, file));
        return true;
      } catch {
        // Continue checking
      }
    }
    return false;
  }

  async build(
    context: BuildContext,
    config?: BuildConfig,
    onProgress?: BuildProgressCallback
  ): Promise<StrategyResult> {
    const startTime = Date.now();
    const adapter = new ProgressAdapter(onProgress);
    adapter.emitStart("nixpacks-build");

    const runtime = new DockerRuntime();
    const imageTag = generateImageName(context.projectName, context.deploymentId);

    const nixpacksEnv = this.buildNixpacksEnv(config);

    const containerConfig = {
      image: config?.nixpacksImage || NIXPACKS_IMAGE,
      cmd: this.buildNixpacksCommand(context, config),
      volumes: [
        { source: context.sourceDir, target: "/app" },
        { source: this.getDockerSocketPath(), target: "/var/run/docker.sock" },
        { source: "forge-nixpacks-cache", target: "/root/.cache/nixpacks" },
      ],
      env: nixpacksEnv,
      workingDir: "/app",
    };

    let container: { id: string } | undefined;

    try {
      container = await runtime.create(containerConfig);
      await runtime.start(container.id);

      void onProgress?.({
        type: "log",
        message: `Building with nixpacks: ${imageTag}`,
        timestamp: new Date(),
        stage: "build",
      });

      let logs = "";
      for await (const entry of runtime.logs(container.id, {
        follow: true,
        stdout: true,
        stderr: true,
      })) {
        logs += entry.message + "\n";
        void onProgress?.({
          // type: entry.stream === "stderr" ? "error" : "log",
          type: "log",
          message: entry.message,
          timestamp: entry.timestamp,
          stage: "nixpacks-build",
          log: false
        });
      }

      const images = await runtime.listImages({ reference: [imageTag] });
      if (images.length === 0) {
        throw new BuildValidationError("Build completed but image not found", { strategy: "nixpacks" });
      }

      const imageId = images[0].id;

      adapter.emitComplete(imageId);

      return {
        success: true,
        image: imageTag,
        logs: `Built image ${imageId.slice(0, 12)}`,
        duration: Date.now() - startTime,
      };
    } catch (err) {
      void onProgress?.({
        type: "error",
        message: err instanceof Error ? err.message : "Build failed",
        timestamp: new Date(),
      });
      throw err;
    } finally {
      if (container) {
        try {
          await runtime.remove(container.id, { force: true, volumes: true });
        } catch {
          // Container may already be removed or removing — don't mask the original error
        }
      }
    }
  }

  private buildNixpacksEnv(config?: BuildConfig): Record<string, string> {
    const env: Record<string, string> = {};

    if (config?.installCommand) env["NIXPACKS_INSTALL_CMD"] = config.installCommand;
    if (config?.buildCommand) env["NIXPACKS_BUILD_CMD"] = config.buildCommand;
    if (config?.startCommand) env["NIXPACKS_START_CMD"] = config.startCommand;

    // Pass through any user-specified env vars
    if (config?.envVars) {
      Object.assign(env, config.envVars);
    }

    return env;
  }

  private buildNixpacksCommand(context: BuildContext, config?: BuildConfig): string[] {
    const imageTag = generateImageName(context.projectName, context.deploymentId);
    let command = `nixpacks build .`;

    if (config?.installCommand) command += ` --install-cmd "${config.installCommand}"`;
    if (config?.buildCommand) command += ` --build-cmd "${config.buildCommand}"`;
    if (config?.startCommand) command += ` --start-cmd "${config.startCommand}"`;

    if (config?.nixpacksArgs && config.nixpacksArgs.length > 0) {
      command += ` ${config.nixpacksArgs.join(" ")}`;
    }

    command += ` --name ${imageTag}`;

    return ["bash", "-c", command];
  }

  private getDockerSocketPath(): string {
    return "/var/run/docker.sock";
    // return process.platform === "win32" ? "//./pipe/docker_engine" : "/var/run/docker.sock";
  }

  getDefaultConfig(): BuildConfig {
    return {
      nixpacksImage: NIXPACKS_IMAGE,
      nixpacksArgs: [],
    };
  }

  validateConfig(config: BuildConfig): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (config.nixpacksImage && !config.nixpacksImage.includes(":")) {
      errors.push("nixpacksImage must include a tag (e.g., 'forge/nixpacks-builder:local')");
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }
}
