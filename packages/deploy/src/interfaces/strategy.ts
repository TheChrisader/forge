/**
 * Deployment strategy interface
 * Allows pluggable deployment strategies (rolling, blue-green, canary, etc.)
 */

export interface DeploymentContext {
  deploymentId: string;
  projectId: string;
  image: string;
  replicas: number;
  env?: Record<string, string>;
  ports?: Array<{ container: number; host?: number }>;
  volumes?: Array<{ source: string; target: string }>;
  healthCheck?: {
    path: string;
    interval: number;
    timeout: number;
    retries: number;
  };
}

export interface DeploymentResult {
  success: boolean;
  containerIds: string[];
  duration: number;
  error?: string;
}

export interface DeploymentProgress {
  phase: "preparing" | "deploying" | "verifying" | "complete" | "failed";
  percentage: number;
  message: string;
  timestamp: Date;
}

export type ProgressCallback = (progress: DeploymentProgress) => void;

export interface IDeploymentStrategy {
  /**
   * Strategy name
   */
  readonly name: string;

  execute(context: DeploymentContext, onProgress?: ProgressCallback): Promise<DeploymentResult>;

  rollback(deploymentId: string, onProgress?: ProgressCallback): Promise<DeploymentResult>;

  validate(context: DeploymentContext): { valid: boolean; errors?: string[] };

  getStatus(deploymentId: string): Promise<{
    phase: string;
    healthy: number;
    unhealthy: number;
    total: number;
  }>;
}

export interface IDeploymentStrategyRegistry {
  register(strategy: IDeploymentStrategy): void;

  get(name: string): IDeploymentStrategy | null;

  getAll(): IDeploymentStrategy[];
}
