import fs from "node:fs";
import path from "node:path";
import DockerIgnore from "@balena/dockerignore";
import type { Ignore } from "@balena/dockerignore";
import { match as minimatchMatch } from "minimatch";

/**
 * Parse and filter paths based on .dockerignore rules.
 * Uses @balena/dockerignore which implements Docker's .dockerignore specification.
 */
export class DockerIgnoreFilter {
  private filter: Ignore;
  private contextRoot: string;

  private constructor(contextRoot: string, filter: Ignore) {
    this.contextRoot = contextRoot;
    this.filter = filter;
  }

  /**
   * Create a DockerIgnoreFilter instance from a .dockerignore file.
   *
   * @param contextPath - Root directory of the build context
   * @param dockerignorePath - Path to the .dockerignore file (default: contextPath/.dockerignore)
   * @returns A DockerIgnoreFilter instance, or null if no .dockerignore exists
   */
  static fromFile(contextPath: string, dockerignorePath?: string): DockerIgnoreFilter | null {
    const ignoreFile = dockerignorePath || path.join(contextPath, ".dockerignore");

    if (!fs.existsSync(ignoreFile)) {
      return null;
    }

    try {
      const content = fs.readFileSync(ignoreFile, "utf-8");
      return DockerIgnoreFilter.fromContent(contextPath, content);
    } catch (error) {
      throw new Error(
        `Failed to read .dockerignore at ${ignoreFile}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Create a DockerIgnoreFilter instance from ignore rules content.
   *
   * @param contextPath - Root directory of the build context
   * @param content - .dockerignore file content
   * @returns A DockerIgnoreFilter instance
   */
  static fromContent(contextPath: string, content: string): DockerIgnoreFilter {
    // const filter = DockerIgnore();
    // @balena/dockerignore expects patterns to be split into an array
    const patterns = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));

    const filter = DockerIgnore().add(patterns);

    // Create the filter using balena's library
    // const DockerIgnore = require("@balena/dockerignore") as typeof BalenaImageFilter;

    return new DockerIgnoreFilter(contextPath, filter);
  }

  /**
   * Check if a file/directory path should be ignored.
   *
   * @param filePath - Absolute or relative path to check
   * @returns true if the path should be ignored, false otherwise
   */
  ignores(filePath: string): boolean {
    // Convert absolute path to relative from context root
    const relativePath = path.isAbsolute(filePath)
      ? path.relative(this.contextRoot, filePath)
      : filePath;

    // Normalize path separators for consistent matching
    const normalizedPath = relativePath.split(path.sep).join("/");

    try {
      return this.filter.ignores(normalizedPath);
    } catch {
      // If pattern matching fails, don't ignore the file
      return false;
    }
  }

  /**
   * Create a tar-fs compatible ignore function.
   *
   * @returns A function compatible with tar-fs's ignore option
   */
  toTarIgnore(): (name: string) => boolean {
    return (name: string) => {
      try {
        return this.ignores(name);
      } catch {
        return false;
      }
    };
  }
}

/**
 * Default ignore patterns to use when no .dockerignore file is present.
 * These are common patterns that should generally be excluded from Docker builds.
 */
export const DEFAULT_IGNORE_PATTERNS = [
  "node_modules",
  ".git",
  ".gitignore",
  ".gitattributes",
  ".env",
  ".env.*",
  ".env.local",
  ".env.*.local",
  "*.log",
  "*.tgz",
  "npm-debug.log*",
  "yarn-debug.log*",
  "yarn-error.log*",
  ".DS_Store",
  "Thumbs.db",
  ".vscode",
  ".idea",
  "*.swp",
  "*.swo",
  "*~",
  ".cache",
  ".parcel-cache",
  ".next",
  ".nuxt",
  "dist",
  "build",
  "coverage",
  ".nyc_output",
  ".pytest_cache",
  "__pycache__",
];

/**
 * Create a simple ignore function for common patterns when no .dockerignore exists.
 *
 * @returns A tar-fs compatible ignore function using default patterns
 */
export function createDefaultIgnore(): (name: string) => boolean {
  // const minimatch = require("minimatch");

  return (filePath: string) => {
    const basename = path.basename(filePath);

    return DEFAULT_IGNORE_PATTERNS.some((pattern) => {
      // Handle patterns like .env.* that match multiple files
      if (pattern.includes("*")) {
        return (
          minimatchMatch([basename], pattern).length > 0 ||
          minimatchMatch([filePath], pattern).length > 0
        );
      }
      // Handle directory patterns (should match the directory itself and any contents)
      if (
        basename === pattern ||
        filePath.startsWith(`${pattern}/`) ||
        filePath.includes(`/${pattern}/`)
      ) {
        return true;
      }
      // Handle exact basename match
      return basename === pattern;
    });
  };
}
