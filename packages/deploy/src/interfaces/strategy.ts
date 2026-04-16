import type {
  ProjectVolumeConfig,
  ProjectHealthCheckConfig,
  ProjectResourceConfig,
} from "@forge/types";

export interface DeployedContainer {
  /** Database ID of the container record */
  id: string;
  /** Docker container ID (used for proxy integration calls) */
  containerId: string;
}

export interface DeploymentContext {
  deploymentId: string;
  projectId: string;
  projectName: string;
  projectSlug: string;
  image: string;
  replicas: number;
  env: Record<string, string>;
  ports: Array<{ containerPort: number; hostPort?: number; protocol?: "tcp" | "udp" }>;
  volumes: ProjectVolumeConfig[];
  healthCheck?: ProjectHealthCheckConfig;
  resources?: ProjectResourceConfig;
  labels: Record<string, string>;

  networkName: string;
  domains: string[];
  targetPort: number;

  activeEnvironment?: "BLUE" | "GREEN";

  canaryPercentage?: number;

  existingContainerIds: string[];
}

export interface DeploymentResult {
  success: boolean;
  containers: DeployedContainer[];
  removedContainerIds: string[];
  duration: number;
  activeEnvironment?: "BLUE" | "GREEN";
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
  readonly strategyName: "ROLLING" | "BLUE_GREEN" | "CANARY" | "RECREATE";

  execute(context: DeploymentContext, onProgress?: ProgressCallback): Promise<DeploymentResult>;

  validate(context: DeploymentContext): { valid: boolean; errors?: string[] };
}

export interface IDeploymentStrategyRegistry {
  register(strategy: IDeploymentStrategy): void;

  get(name: string): IDeploymentStrategy | null;

  getAll(): IDeploymentStrategy[];
}
