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

  async build(
    context: BuildContext,
    config?: BuildConfig,
    onProgress?: BuildProgressCallback
  ): Promise<BuildResult> {
    const startTime = Date.now();
    const pythonVersion = config?.pythonVersion ?? "3.11";

    void onProgress?.({
      type: "stage",
      message: `Starting ${this.name} build...`,
      timestamp: new Date(),
      stage: "init",
    });

    void onProgress?.({
      type: "log",
      message: `${this.name} build stub for ${context.projectId} (will use python ${pythonVersion})`,
      timestamp: new Date(),
    });

    void onProgress?.({
      type: "complete",
      message: `${this.name} build completed (stub)`,
      timestamp: new Date(),
      progress: 100,
    });

    return Promise.resolve({
      success: true,
      logs: `Python build stub for ${context.projectId}`,
      duration: Date.now() - startTime,
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
