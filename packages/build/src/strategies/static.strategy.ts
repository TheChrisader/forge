/**
 * Static site build strategy
 * Fallback strategy for static HTML/CSS/JS sites
 * Uses script discovery to find actual commands from package.json for static site generators
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
import { discoverNodeJSScripts, analyzeDiscoveredScripts } from "../utils/script-discovery.js";

/**
 * Priority 100 - fallback for static sites
 */
export class StaticBuildStrategy implements IBuildStrategy {
  readonly name = "static";

  async detect(context: BuildContext): Promise<DetectionResult> {
    const indexPath = path.join(context.sourceDir, "index.html");

    try {
      await fs.access(indexPath);

      const hugoConfigPath = path.join(context.sourceDir, "hugo.toml");
      const jekyllConfigPath = path.join(context.sourceDir, "_config.yml");
      const astroConfigPath = path.join(context.sourceDir, "astro.config.mjs");

      const [hasHugo, hasJekyll, hasAstro] = await Promise.all([
        fs
          .access(hugoConfigPath)
          .then(() => true)
          .catch(() => false),
        fs
          .access(jekyllConfigPath)
          .then(() => true)
          .catch(() => false),
        fs
          .access(astroConfigPath)
          .then(() => true)
          .catch(() => false),
      ]);

      if (hasHugo) {
        return {
          detected: true,
          framework: "Hugo",
          confidence: 0.9,
          config: {
            installCommand: "hugo",
            buildCommand: "hugo --minify",
            port: 1313,
          },
          discoveredScripts: {
            available: [],
            missing: [],
            source: "hugo.toml",
            sourcePath: hugoConfigPath,
          },
        };
      }

      if (hasJekyll) {
        return {
          detected: true,
          framework: "Jekyll",
          confidence: 0.9,
          config: {
            installCommand: "bundle install",
            buildCommand: "bundle exec jekyll build",
            port: 4000,
          },
          discoveredScripts: {
            available: [],
            missing: [],
            source: "_config.yml",
            sourcePath: jekyllConfigPath,
          },
        };
      }

      if (hasAstro) {
        const discoveredScripts = await discoverNodeJSScripts(context.sourceDir);
        const scriptAnalysis = analyzeDiscoveredScripts(discoveredScripts, ["build", "start"]);

        return {
          detected: true,
          framework: "Astro",
          confidence: 0.9,
          config: {
            installCommand: "npm ci",
            buildCommand: "npm run build",
            startCommand: "npm run preview",
            port: 3000,
          },
          discoveredScripts: {
            available: scriptAnalysis.available,
            missing: scriptAnalysis.missing,
            source: discoveredScripts?.source ?? "astro.config.mjs",
            sourcePath: discoveredScripts?.sourcePath ?? astroConfigPath,
          },
        };
      }

      return {
        detected: true,
        framework: "Static",
        confidence: 0.5,
        config: {
          port: 80,
        },
        discoveredScripts: {
          available: [],
          missing: [],
          source: "index.html",
          sourcePath: indexPath,
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
    const port = config?.port ?? 80;

    emitter?.emit("progress", {
      type: "stage",
      message: `Starting ${this.name} build...`,
      timestamp: new Date(),
      stage: "init",
    } as BuildProgressEvent);

    emitter?.emit("progress", {
      type: "log",
      message: `${this.name} build stub for ${context.projectId} (will serve on port ${port})`,
      timestamp: new Date(),
    } as BuildProgressEvent);

    emitter?.emit("progress", {
      type: "complete",
      message: `${this.name} build completed (stub)`,
      timestamp: new Date(),
      progress: 100,
    } as BuildProgressEvent);

    return {
      success: true,
      logs: `Static build stub for ${context.projectId}`,
      duration: Date.now() - startTime,
    };
  }

  getDefaultConfig(): BuildConfig {
    return {
      port: 80,
    };
  }

  validateConfig(_config: BuildConfig): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }
}
