/**
 * Build strategy interface
 * Allows pluggable build strategies for different frameworks/languages
 */

import type { EventEmitter } from "eventemitter3";

/**
 * Progress event emitted during build
 * Consumers can listen to these events for real-time build updates
 *
 * Named BuildProgressEvent to avoid conflict with @forge/docker's BuildProgress
 * which is used for Docker runtime callbacks (stream/status/progress/error)
 */
export interface BuildProgressEvent {
  type: "log" | "stage" | "complete" | "error";
  message: string;
  timestamp: Date;
  /** Strategy-specific stage name (e.g., "pull", "build", "install") */
  stage?: string;
  /** Progress percentage 0-100 */
  progress?: number;
}

export interface BuildContext {
  projectId: string;
  deploymentId: string;
  workDir: string;
  sourceDir: string;
  outputDir: string;
  env?: Record<string, string>;
  buildArgs?: Record<string, string>;
  noCache?: boolean;
}

export interface BuildResult {
  success: boolean;
  image?: string;
  logs: string;
  duration: number;
  artifacts?: Array<{
    name: string;
    path: string;
    size: number;
  }>;
  error?: string;
}

export interface BuildConfig {
  dockerfile?: string;
  buildpack?: string;
  baseImage?: string;
  nodeVersion?: string;
  pythonVersion?: string;
  goVersion?: string;
  installCommand?: string;
  buildCommand?: string;
  startCommand?: string;
  port?: number;
  envVars?: Record<string, string>;
  // Script discovery options
  /** Whether to auto-discover scripts from manifest files (default: true) */
  autoDiscoverScripts?: boolean;
  /** Explicit command overrides (take priority over discovered scripts) */
  overrideInstallCommand?: string;
  overrideBuildCommand?: string;
  overrideStartCommand?: string;
  /** Environment context for script variant selection (e.g., "production", "staging") */
  environment?: string;
}

export interface DetectionResult {
  detected: boolean;
  framework?: string;
  version?: string;
  confidence: number; // 0-1
  config?: BuildConfig;
  /** Metadata about discovered scripts from manifest files */
  discoveredScripts?: {
    /** All available script names from the manifest */
    available: string[];
    /** Required script names that were not found */
    missing: string[];
    /** Type of manifest file (e.g., "package.json", "requirements.txt") */
    source: string;
    /** Path to the manifest file */
    sourcePath: string;
  };
}

export interface IBuildStrategy {
  readonly name: string;
  detect(context: BuildContext): Promise<DetectionResult>;

  /**
   * Executes the build with optional progress reporting
   * @param context - Build context containing project info
   * @param config - Optional build configuration
   * @param emitter - Optional event emitter for progress events
   */
  build(
    context: BuildContext,
    config?: BuildConfig,
    emitter?: EventEmitter
  ): Promise<BuildResult>;

  getDefaultConfig(): BuildConfig;
  validateConfig(config: BuildConfig): { valid: boolean; errors?: string[] };
}

export interface IBuildStrategyRegistry {
  register(strategy: IBuildStrategy): void;
  getAll(): IBuildStrategy[];
  /** Now throws NoStrategyFoundError if no strategy detected (was: returns null) */
  detect(context: BuildContext): Promise<IBuildStrategy>;
  get(name: string): IBuildStrategy | null;
}
