/**
 * Go build strategy
 * Detects Go projects and applications
 * Uses script discovery to find actual commands from go.mod
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type {
  IBuildStrategy,
  BuildContext,
  DetectionResult,
  BuildResult,
  BuildConfig,
  BuildProgressCallback,
} from "../interfaces/strategy.js";
import {
  discoverGoScripts,
  analyzeDiscoveredScripts,
  type DiscoveredScripts,
} from "../utils/script-discovery.js";
import { resolveAllCommands, normalizeFrameworkName } from "../utils/command-resolution.js";

/**
 * Priority 30 - checks for Go projects
 */
export class GoBuildStrategy implements IBuildStrategy {
  readonly name = "go";

  async detect(context: BuildContext): Promise<DetectionResult> {
    const goModPath = path.join(context.sourceDir, "go.mod");
    const mainGoPath = path.join(context.sourceDir, "main.go");

    try {
      const [hasGoMod, hasMainGo] = await Promise.all([
        fs
          .access(goModPath)
          .then(() => true)
          .catch(() => false),
        fs
          .access(mainGoPath)
          .then(() => true)
          .catch(() => false),
      ]);

      if (!hasGoMod && !hasMainGo) {
        return { detected: false, confidence: 0 };
      }

      const discoveredScripts = await discoverGoScripts(context.sourceDir);
      const scriptAnalysis = analyzeDiscoveredScripts(discoveredScripts, ["build", "start"]);

      const detectedFramework = await this.detectFramework(context.sourceDir, hasGoMod);

      if (!detectedFramework) {
        return this.buildDetectionResult(
          "Go",
          "1.21",
          hasGoMod ? 0.8 : 0.6,
          discoveredScripts,
          scriptAnalysis,
          { port: 8080 }
        );
      }

      return this.buildDetectionResult(
        detectedFramework.name,
        "1.21",
        detectedFramework.confidence,
        discoveredScripts,
        scriptAnalysis,
        detectedFramework.defaults
      );
    } catch {
      return { detected: false, confidence: 0 };
    }
  }

  /**
   * Detect the specific Go framework from go.mod
   */
  private async detectFramework(
    sourceDir: string,
    hasGoMod: boolean
  ): Promise<{ name: string; confidence: number; defaults: Partial<BuildConfig> } | null> {
    if (!hasGoMod) {
      return null;
    }

    const content = await fs.readFile(path.join(sourceDir, "go.mod"), "utf-8");
    const lowerContent = content.toLowerCase();

    // Common Go web frameworks/libraries
    if (
      lowerContent.includes("gin-gonic/gin") ||
      lowerContent.includes("github.com/gin-gonic/gin")
    ) {
      return {
        name: "Gin",
        confidence: 0.9,
        defaults: { port: 8080 },
      };
    }

    if (lowerContent.includes("gorilla/mux") || lowerContent.includes("github.com/gorilla/mux")) {
      return {
        name: "Gorilla Mux",
        confidence: 0.85,
        defaults: { port: 8080 },
      };
    }

    if (lowerContent.includes("fiber") || lowerContent.includes("gofiber/fiber")) {
      return {
        name: "Fiber",
        confidence: 0.9,
        defaults: { port: 3000 },
      };
    }

    if (
      lowerContent.includes("echo") ||
      lowerContent.includes("labstack/echo") ||
      lowerContent.includes("github.com/labstack/echo")
    ) {
      return {
        name: "Echo",
        confidence: 0.9,
        defaults: { port: 8080 },
      };
    }

    return null;
  }

  /**
   * Build a DetectionResult with resolved commands
   */
  private buildDetectionResult(
    framework: string,
    version: string,
    confidence: number,
    discoveredScripts: DiscoveredScripts | null,
    scriptAnalysis: { available: string[]; missing: string[] },
    defaults: Partial<BuildConfig>
  ): DetectionResult {
    const normalizedFramework = normalizeFrameworkName(framework);

    const {
      install,
      build,
      start,
      allWarnings: _allWarnings,
    } = resolveAllCommands(discoveredScripts, {
      framework: normalizedFramework,
      allowNull: true,
    });

    const config: BuildConfig = {
      installCommand: install.command ?? undefined,
      buildCommand: build.command ?? undefined,
      startCommand: start.command ?? undefined,
      port: defaults.port,
      goVersion: "1.21",
    };

    return {
      detected: true,
      framework,
      version,
      confidence,
      config,
      discoveredScripts: {
        available: scriptAnalysis.available,
        missing: scriptAnalysis.missing,
        source: discoveredScripts?.source ?? "none",
        sourcePath: discoveredScripts?.sourcePath ?? "",
      },
    };
  }

  async build(
    context: BuildContext,
    config?: BuildConfig,
    onProgress?: BuildProgressCallback
  ): Promise<BuildResult> {
    const startTime = Date.now();
    const goVersion = config?.goVersion ?? "1.21";

    void onProgress?.({
      type: "stage",
      message: `Starting ${this.name} build...`,
      timestamp: new Date(),
      stage: "init",
    });

    void onProgress?.({
      type: "log",
      message: `${this.name} build stub for ${context.projectId} (will use go ${goVersion})`,
      timestamp: new Date(),
    });

    void onProgress?.({
      type: "complete",
      message: `${this.name} build completed (stub)`,
      timestamp: new Date(),
      progress: 100,
    });

    return {
      success: true,
      logs: `Go build stub for ${context.projectId}`,
      duration: Date.now() - startTime,
    };
  }

  getDefaultConfig(): BuildConfig {
    return {
      goVersion: "1.21",
      installCommand: "go mod download",
      buildCommand: "go build -o app",
      startCommand: "./app",
      port: 8080,
    };
  }

  validateConfig(config: BuildConfig): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!config.buildCommand) {
      errors.push("buildCommand is required");
    }
    if (!config.startCommand) {
      errors.push("startCommand is required");
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }
}
