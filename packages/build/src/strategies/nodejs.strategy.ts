/**
 * Node.js build strategy
 * Detects Node.js projects (Next.js, Vite, NestJS, Express, vanilla Node.js)
 * Uses script discovery to find actual build/start commands from package.json
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
import {
  discoverNodeJSScripts,
  analyzeDiscoveredScripts,
  type DiscoveredScripts,
} from "../utils/script-discovery.js";
import { resolveAllCommands, normalizeFrameworkName } from "../utils/command-resolution.js";

/**
 * Priority 10 - checks for Node.js projects
 */
export class NodeJsBuildStrategy implements IBuildStrategy {
  readonly name = "nodejs";

  async detect(context: BuildContext): Promise<DetectionResult> {
    const packageJsonPath = path.join(context.sourceDir, "package.json");

    try {
      const content = await fs.readFile(packageJsonPath, "utf-8");
      const pkg = JSON.parse(content) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      const deps = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>;

      const discoveredScripts = await discoverNodeJSScripts(context.sourceDir);
      const scriptAnalysis = analyzeDiscoveredScripts(discoveredScripts);

      const detectedFramework = this.detectFramework(deps);

      if (!detectedFramework) {
        if (Object.keys(deps).length > 0) {
          return this.buildDetectionResult(
            "Node.js",
            this.extractVersion("0.0.0"),
            0.6,
            discoveredScripts,
            scriptAnalysis,
            { port: 3000 }
          );
        }
        return { detected: false, confidence: 0 };
      }

      return this.buildDetectionResult(
        detectedFramework.name,
        this.extractVersion(detectedFramework.version),
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
   * Detect the specific Node.js framework from dependencies
   */
  private detectFramework(
    deps: Record<string, string>
  ): { name: string; version: string; confidence: number; defaults: Partial<BuildConfig> } | null {
    if (deps.next) {
      return {
        name: "Next.js",
        version: deps.next,
        confidence: 0.95,
        defaults: { port: 3000 },
      };
    }

    if (deps.nuxt || deps["nuxt-edge"] || deps["nuxt3"] || deps["@nuxt/bridge"]) {
      return {
        name: "Nuxt",
        version: deps.nuxt || deps["nuxt-edge"] || deps["nuxt3"] || deps["@nuxt/bridge"],
        confidence: 0.95,
        defaults: { port: 3000 },
      };
    }

    if (deps["@remix-run/react"] || deps["@remix-run/node"]) {
      return {
        name: "Remix",
        version: deps["@remix-run/react"] || deps["@remix-run/node"],
        confidence: 0.92,
        defaults: { port: 3000 },
      };
    }

    if (deps.astro) {
      return {
        name: "Astro",
        version: deps.astro,
        confidence: 0.9,
        defaults: { port: 3000 },
      };
    }

    if (deps.vite) {
      return {
        name: "Vite",
        version: deps.vite,
        confidence: 0.88,
        defaults: { port: 3000 },
      };
    }

    if (deps["@nestjs/core"] || deps["@nestjs/common"]) {
      return {
        name: "NestJS",
        version: deps["@nestjs/core"] || deps["@nestjs/common"],
        confidence: 0.9,
        defaults: { port: 3000 },
      };
    }

    if (deps["@sveltejs/kit"]) {
      return {
        name: "SvelteKit",
        version: deps["@sveltejs/kit"],
        confidence: 0.9,
        defaults: { port: 3000 },
      };
    }

    if (deps.express) {
      return {
        name: "Express",
        version: deps.express,
        confidence: 0.7,
        defaults: { port: 3000 },
      };
    }

    if (deps.fastify) {
      return {
        name: "Fastify",
        version: deps.fastify,
        confidence: 0.7,
        defaults: { port: 3000 },
      };
    }

    if (deps.koa) {
      return {
        name: "Koa",
        version: deps.koa,
        confidence: 0.7,
        defaults: { port: 3000 },
      };
    }

    if (deps.react || deps["react-dom"] || deps["@react-router/dom"]) {
      return {
        name: "React",
        version: deps.react || deps["react-dom"] || deps["@react-router/dom"],
        confidence: 0.65,
        defaults: { port: 3000 },
      };
    }

    if (deps.vue) {
      return {
        name: "Vue",
        version: deps.vue,
        confidence: 0.65,
        defaults: { port: 3000 },
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
      nodeVersion: "20",
    };

    return {
      detected: true,
      framework,
      version: this.extractVersion(version),
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

  async build(context: BuildContext, config?: BuildConfig): Promise<BuildResult> {
    const nodeVersion = config?.nodeVersion ?? "20";
    return Promise.resolve({
      success: true,
      logs: `Node.js build stub for ${context.projectId} (Sprint 3: will use node ${nodeVersion})`,
      duration: 0,
    });
  }

  getDefaultConfig(): BuildConfig {
    return {
      nodeVersion: "20",
      installCommand: "npm ci",
      buildCommand: "npm run build",
      startCommand: "npm start",
      port: 3000,
    };
  }

  validateConfig(config: BuildConfig): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // With auto-discovery and fallbacks, we only require explicit commands
    // if auto-discovery is disabled
    if (config.autoDiscoverScripts === false) {
      if (!config.installCommand) {
        errors.push("installCommand is required when autoDiscoverScripts is false");
      }
      if (!config.startCommand) {
        errors.push("startCommand is required when autoDiscoverScripts is false");
      }
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  private extractVersion(versionRange: string): string {
    // Extract version from "^14.0.0" or "14.0.0" → "14.0.0"
    return versionRange.replace(/^[\^~]/, "");
  }
}
