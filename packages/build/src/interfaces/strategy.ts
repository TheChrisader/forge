/**
 * Build strategy interface
 * Allows pluggable build strategies for different frameworks/languages
 */

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
}

export interface DetectionResult {
  detected: boolean;
  framework?: string;
  version?: string;
  confidence: number; // 0-1
  config?: BuildConfig;
}

export interface IBuildStrategy {
  readonly name: string;
  detect(context: BuildContext): Promise<DetectionResult>;
  build(context: BuildContext, config?: BuildConfig): Promise<BuildResult>;
  getDefaultConfig(): BuildConfig;
  validateConfig(config: BuildConfig): { valid: boolean; errors?: string[] };
}

export interface IBuildStrategyRegistry {
  register(strategy: IBuildStrategy): void;
  getAll(): IBuildStrategy[];
  detect(context: BuildContext): Promise<IBuildStrategy | null>;
  get(name: string): IBuildStrategy | null;
}
