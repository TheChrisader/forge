/**
 * Python build strategy
 * Detects Python projects (FastAPI, Django, Flask, vanilla Python)
 * Uses script discovery to find actual commands from manifest files
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
  discoverPythonScripts,
  analyzeDiscoveredScripts,
  type DiscoveredScripts,
} from "../utils/script-discovery.js";
import { resolveAllCommands, normalizeFrameworkName } from "../utils/command-resolution.js";

/**
 * Priority 20 - checks for Python projects
 */
export class PythonBuildStrategy implements IBuildStrategy {
  readonly name = "python";

  async detect(context: BuildContext): Promise<DetectionResult> {
    const requirementsPath = path.join(context.sourceDir, "requirements.txt");
    const pyprojectPath = path.join(context.sourceDir, "pyproject.toml");
    const setupPyPath = path.join(context.sourceDir, "setup.py");

    try {
      const [hasRequirements, hasPyproject, hasSetupPy] = await Promise.all([
        fs
          .access(requirementsPath)
          .then(() => true)
          .catch(() => false),
        fs
          .access(pyprojectPath)
          .then(() => true)
          .catch(() => false),
        fs
          .access(setupPyPath)
          .then(() => true)
          .catch(() => false),
      ]);

      if (!hasRequirements && !hasPyproject && !hasSetupPy) {
        return { detected: false, confidence: 0 };
      }

      const discoveredScripts = await discoverPythonScripts(context.sourceDir);
      const scriptAnalysis = analyzeDiscoveredScripts(discoveredScripts, ["start"]);

      const detectedFramework = await this.detectFramework(
        context.sourceDir,
        hasRequirements,
        hasPyproject
      );

      if (!detectedFramework) {
        return this.buildDetectionResult("Python", "3.11", 0.7, discoveredScripts, scriptAnalysis, {
          port: 8000,
        });
      }

      return this.buildDetectionResult(
        detectedFramework.name,
        detectedFramework.version ?? "3.11",
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
   * Detect the specific Python framework from manifest files
   */
  private async detectFramework(
    sourceDir: string,
    hasRequirements: boolean,
    hasPyproject: boolean
  ): Promise<{
    name: string;
    version?: string;
    confidence: number;
    defaults: Partial<BuildConfig>;
  } | null> {
    if (hasRequirements) {
      const content = await fs.readFile(path.join(sourceDir, "requirements.txt"), "utf-8");
      const lowerContent = content.toLowerCase();

      if (lowerContent.includes("fastapi")) {
        return {
          name: "FastAPI",
          confidence: 0.9,
          defaults: { port: 8000 },
        };
      }

      if (lowerContent.includes("django")) {
        return {
          name: "Django",
          confidence: 0.9,
          defaults: { port: 8000 },
        };
      }

      if (lowerContent.includes("flask")) {
        return {
          name: "Flask",
          confidence: 0.85,
          defaults: { port: 5000 },
        };
      }

      if (lowerContent.includes("tornado")) {
        return {
          name: "Tornado",
          confidence: 0.85,
          defaults: { port: 8000 },
        };
      }
    }

    // Check pyproject.toml for framework info
    if (hasPyproject) {
      const content = await fs.readFile(path.join(sourceDir, "pyproject.toml"), "utf-8");
      const lowerContent = content.toLowerCase();

      if (lowerContent.includes("fastapi")) {
        return {
          name: "FastAPI",
          confidence: 0.9,
          defaults: { port: 8000 },
        };
      }

      if (lowerContent.includes("django")) {
        return {
          name: "Django",
          confidence: 0.9,
          defaults: { port: 8000 },
        };
      }

      if (lowerContent.includes("flask")) {
        return {
          name: "Flask",
          confidence: 0.85,
          defaults: { port: 5000 },
        };
      }
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
      start,
      allWarnings: _allWarnings,
    } = resolveAllCommands(discoveredScripts, {
      framework: normalizedFramework,
      allowNull: true,
    });

    const config: BuildConfig = {
      installCommand: install.command ?? undefined,
      startCommand: start.command ?? undefined,
      port: defaults.port,
      pythonVersion: "3.11",
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

  async build(context: BuildContext, config?: BuildConfig): Promise<BuildResult> {
    const pythonVersion = config?.pythonVersion ?? "3.11";
    return Promise.resolve({
      success: true,
      logs: `Python build stub for ${context.projectId} (Sprint 3: will use python ${pythonVersion})`,
      duration: 0,
    });
  }

  getDefaultConfig(): BuildConfig {
    return {
      pythonVersion: "3.11",
      installCommand: "pip install -r requirements.txt",
      startCommand: "python main.py",
      port: 8000,
    };
  }

  validateConfig(config: BuildConfig): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!config.installCommand) {
      errors.push("installCommand is required");
    }
    if (!config.startCommand) {
      errors.push("startCommand is required");
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }
}
