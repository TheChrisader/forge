/**
 * Script discovery utilities
 * Parses manifest files (package.json, requirements.txt, go.mod, etc.)
 * to extract available build and start scripts
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * Result of parsing package.json scripts
 */
export interface PackageJsonScripts {
  /** Build script command if present */
  build?: string;
  /** Start script command if present */
  start?: string;
  /** Install script command if present */
  install?: string;
  /** All available scripts from the manifest */
  all: Record<string, string>;
  /** Path to the package.json file that was parsed */
  sourcePath: string;
}

/**
 * Result of discovering scripts from any manifest file
 */
export interface DiscoveredScripts {
  /** Build command if discovered */
  build?: string;
  /** Start command if discovered */
  start?: string;
  /** Install command if discovered */
  install?: string;
  /** All available scripts from the manifest */
  all: Record<string, string>;
  /** Type of manifest file (e.g., "package.json", "requirements.txt") */
  source: string;
  /** Path to the manifest file */
  sourcePath: string;
}

/**
 * Framework-specific script patterns for detecting build commands
 */
const FRAMEWORK_SCRIPT_PATTERNS = {
  nextjs: ["build", "build:prod", "build:production"],
  vite: ["build", "build:prod", "build:production"],
  nestjs: ["build", "build:prod", "build:nest"],
  react: ["build", "build:prod", "build:production"],
  vue: ["build", "build:prod"],
  svelte: ["build", "build:prod"],
  astro: ["build", "build:prod"],
  nuxt: ["build", "build:prod", "generate"],
  remix: ["build", "build:prod"],
};

/**
 * Framework-specific script patterns for detecting start commands
 */
const START_SCRIPT_PATTERNS = {
  nextjs: ["start", "start:prod", "start:production"],
  vite: ["preview", "start", "preview:dist"],
  nestjs: ["start:prod", "start:production", "start"],
  express: ["start", "start:prod"],
  fastify: ["start", "start:prod"],
  koa: ["start", "start:prod"],
};

/**
 * Parse package.json and extract scripts
 *
 * @param packageJsonPath - Absolute path to package.json
 * @returns PackageJsonScripts with available scripts
 * @throws Error if file cannot be read or parsed
 */
export async function parsePackageJsonScripts(
  packageJsonPath: string
): Promise<PackageJsonScripts> {
  try {
    const content = await fs.readFile(packageJsonPath, "utf-8");
    const pkg = JSON.parse(content) as {
      scripts?: Record<string, string>;
    };

    const scripts = pkg.scripts || {};

    return {
      build: scripts.build,
      start: scripts.start,
      install: scripts.install || scripts.preinstall || scripts.postinstall,
      all: scripts,
      sourcePath: packageJsonPath,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`package.json not found at ${packageJsonPath}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in package.json at ${packageJsonPath}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Find the best matching script name from available options
 *
 * @param availableScripts - All available script names
 * @param patterns - Array of pattern names to try (highest priority first)
 * @returns The best matching script name, or undefined if no match
 */
export function findBestScriptMatch(
  availableScripts: string[],
  patterns: string[]
): string | undefined {
  for (const pattern of patterns) {
    if (availableScripts.includes(pattern)) {
      return pattern;
    }
  }
  return undefined;
}

/**
 * Get environment-specific script variant names
 *
 * @param baseScript - Base script name (e.g., "build")
 * @param environment - Environment context (e.g., "production", "staging")
 * @returns Array of script variant names to try, in priority order
 */
export function getEnvironmentScriptVariants(baseScript: string, environment?: string): string[] {
  const variants = [baseScript];

  if (environment) {
    const env = environment.toLowerCase();
    // Try environment-specific variants first
    variants.unshift(`${baseScript}:${env}`);
    variants.unshift(`${baseScript}:${env === "production" ? "prod" : env}`);
  }

  // Add common production variants
  if (baseScript === "build") {
    variants.push("build:prod", "build:production");
  }
  if (baseScript === "start") {
    variants.push("start:prod", "start:production");
  }

  return variants;
}

/**
 * Discover scripts from a Node.js project (package.json)
 *
 * @param sourceDir - Project source directory
 * @param options - Discovery options
 * @returns DiscoveredScripts or null if no package.json found
 */
export async function discoverNodeJSScripts(
  sourceDir: string,
  options?: {
    /** Framework hint for better script detection */
    framework?: string;
    /** Environment context for variant selection */
    environment?: string;
  }
): Promise<DiscoveredScripts | null> {
  const packageJsonPath = path.join(sourceDir, "package.json");

  try {
    const parsed = await parsePackageJsonScripts(packageJsonPath);
    const available = Object.keys(parsed.all);

    const framework = options?.framework?.toLowerCase() ?? "generic";
    const patterns = FRAMEWORK_SCRIPT_PATTERNS[framework as keyof typeof FRAMEWORK_SCRIPT_PATTERNS];
    const startPatterns = START_SCRIPT_PATTERNS[framework as keyof typeof START_SCRIPT_PATTERNS];

    let buildCommand = parsed.build;
    if (!buildCommand && patterns) {
      const match = findBestScriptMatch(available, patterns);
      if (match) {
        buildCommand = parsed.all[match];
      }
    }

    let startCommand = parsed.start;
    if (!startCommand && startPatterns) {
      const match = findBestScriptMatch(available, startPatterns);
      if (match) {
        startCommand = parsed.all[match];
      }
    }

    return {
      build: buildCommand,
      start: startCommand,
      install: parsed.install,
      all: parsed.all,
      source: "package.json",
      sourcePath: packageJsonPath,
    };
  } catch {
    return null;
  }
}

/**
 * Discover scripts from a Python project (requirements.txt, pyproject.toml, setup.py)
 *
 * @param sourceDir - Project source directory
 * @returns DiscoveredScripts or null if no Python manifest found
 */
export async function discoverPythonScripts(sourceDir: string): Promise<DiscoveredScripts | null> {
  const requirementsPath = path.join(sourceDir, "requirements.txt");
  const pyprojectPath = path.join(sourceDir, "pyproject.toml");
  const setupPyPath = path.join(sourceDir, "setup.py");

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
    return null;
  }

  let installCommand: string | undefined;
  let sourcePath: string;

  if (hasRequirements) {
    installCommand = `pip install -r requirements.txt`;
    sourcePath = requirementsPath;
  } else if (hasPyproject) {
    installCommand = `pip install -e .`;
    sourcePath = pyprojectPath;
  } else {
    installCommand = `pip install -e .`;
    sourcePath = setupPyPath;
  }

  // Try to read scripts from pyproject.toml (if using modern Python tooling)
  let allScripts: Record<string, string> = {};
  if (hasPyproject) {
    try {
      const content = await fs.readFile(pyprojectPath, "utf-8");
      // Basic parsing of [project.scripts] section
      const scriptsMatch = content.match(/\[project\.scripts\]([\s\S]*?)(?=\[|$)/);
      if (scriptsMatch) {
        const scriptLines = scriptsMatch[1].split("\n");
        for (const line of scriptLines) {
          const match = line.match(/^\s*(\w+)\s*=\s*["']([^"']+)["']/);
          if (match) {
            allScripts[match[1]] = match[2];
          }
        }
      }
    } catch {
      // Ignore parsing errors
    }
  }

  return {
    install: installCommand,
    all: allScripts,
    source: hasRequirements ? "requirements.txt" : hasPyproject ? "pyproject.toml" : "setup.py",
    sourcePath,
  };
}

/**
 * Discover scripts from a Go project (go.mod)
 *
 * @param sourceDir - Project source directory
 * @returns DiscoveredScripts or null if no go.mod found
 */
export async function discoverGoScripts(sourceDir: string): Promise<DiscoveredScripts | null> {
  const goModPath = path.join(sourceDir, "go.mod");

  try {
    await fs.access(goModPath);
  } catch {
    return null;
  }

  return {
    install: "go mod download",
    build: "go build -o app",
    start: "./app",
    all: {},
    source: "go.mod",
    sourcePath: goModPath,
  };
}

/**
 * Discover scripts from any supported manifest file in the project directory
 *
 * @param sourceDir - Project source directory
 * @param options - Discovery options
 * @returns DiscoveredScripts with available scripts and source information
 */
export async function discoverScripts(
  sourceDir: string,
  options?: {
    /** Framework hint for better script detection */
    framework?: string;
    /** Environment context for variant selection */
    environment?: string;
  }
): Promise<DiscoveredScripts | null> {
  const nodeScripts = await discoverNodeJSScripts(sourceDir, options);
  if (nodeScripts) {
    return nodeScripts;
  }

  const pythonScripts = await discoverPythonScripts(sourceDir);
  if (pythonScripts) {
    return pythonScripts;
  }

  const goScripts = await discoverGoScripts(sourceDir);
  if (goScripts) {
    return goScripts;
  }

  return null;
}

/**
 * Analyze discovered scripts and report what's missing
 *
 * @param discovered - Discovered scripts from discoverScripts()
 * @param requiredScripts - Script types that are required
 * @returns Object with available and missing script names
 */
export function analyzeDiscoveredScripts(
  discovered: DiscoveredScripts | null,
  requiredScripts: Array<"build" | "start" | "install"> = ["build", "start"]
): {
  available: string[];
  missing: string[];
} {
  const available: string[] = [];
  const missing: string[] = [];

  if (!discovered) {
    return { available: [], missing: requiredScripts };
  }

  // Add all discovered script names
  for (const name of Object.keys(discovered.all)) {
    available.push(name);
  }

  // Check for required scripts
  for (const required of requiredScripts) {
    if (!discovered[required]) {
      missing.push(required);
    }
  }

  return { available, missing };
}
