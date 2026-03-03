/**
 * Service layer interfaces
 * Define contracts for all business logic services
 */

import type {
  Project,
  ProjectWithRelations,
  Deployment,
  DeploymentStatus,
  Service,
  DockerContainer,
  CreateProjectRequest,
  UpdateProjectRequest,
  DeployProjectRequest,
  PortMapping,
  ResourceLimits,
  ContainerHealthCheckConfig,
  RestartPolicy,
  ContainerStats,
  ExecResult,
  ExecOptions,
  LogOptions,
} from "@forge/types";

export interface IProjectService {
  create(data: CreateProjectRequest): Promise<Project>;
  update(id: string, data: UpdateProjectRequest): Promise<Project>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<ProjectWithRelations | null>;
  list(filters?: {
    page?: number;
    limit?: number;
    status?: string[];
  }): Promise<{ projects: Project[]; total: number }>;
  deploy(id: string, data?: DeployProjectRequest): Promise<Deployment>;
  rollback(id: string, deploymentId?: string): Promise<Deployment>;
  scale(id: string, replicas: number): Promise<void>;
}

export interface IDeploymentService {
  create(projectId: string): Promise<Deployment>;
  getById(id: string): Promise<Deployment | null>;
  getByProject(projectId: string): Promise<Deployment[]>;
  list(filters?: {
    projectId?: string;
    status?: DeploymentStatus;
    page?: number;
    limit?: number;
  }): Promise<{ deployments: Deployment[]; total: number }>;
  deploy(
    projectId: string,
    options?: {
      gitBranch?: string;
      gitCommit?: string;
      buildArgs?: Record<string, string>;
    }
  ): Promise<Deployment>;
  updateStatus(id: string, status: DeploymentStatus, error?: string): Promise<Deployment>;
  cancel(id: string): Promise<void>;
  getLogs(id: string): Promise<string>;
}

export interface IServiceManagementService {
  create(data: { projectId: string; type: string; engine?: string }): Promise<Service>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<Service | null>;
  getByProject(projectId: string): Promise<Service[]>;
  getConnection(id: string): Promise<{
    host: string;
    port: number;
    url?: string;
  }>;
  start(id: string): Promise<void>;
  stop(id: string): Promise<void>;
  restart(id: string): Promise<void>;
}

export interface IContainerService {
  create(config: ContainerCreateConfig): Promise<DockerContainer>;
  start(id: string): Promise<void>;
  stop(id: string, timeout?: number): Promise<void>;
  restart(id: string): Promise<void>;
  remove(id: string, force?: boolean): Promise<void>;
  getById(id: string): Promise<DockerContainer | null>;
  getByProject(projectId: string): Promise<DockerContainer[]>;
  getByDeployment(deploymentId: string): Promise<DockerContainer[]>;
  getLogs(id: string, options?: LogOptions): Promise<string[]>;
  getStats(id: string): Promise<ContainerStats>;
  exec(id: string, command: string[], options?: ExecOptions): Promise<ExecResult>;
}

/**
 * Container creation configuration
 * Extends DockerRuntime's ContainerConfig with Forge-specific options
 */
export interface ContainerCreateConfig {
  /**
   * Project ID (required for database relationship)
   */
  projectId: string;

  /**
   * Deployment ID (required for database relationship)
   */
  deploymentId: string;

  /**
   * Docker image to run
   */
  image: string;

  /**
   * Container name (optional - will be generated if not provided)
   */
  name?: string;

  /**
   * Command to run (overrides image CMD)
   */
  cmd?: string[];

  /**
   * Entrypoint (overrides image ENTRYPOINT)
   */
  entrypoint?: string[];

  /**
   * Environment variables
   */
  env?: Record<string, string>;

  /**
   * Port mappings
   */
  ports?: PortMapping[];

  /**
   * Volume configurations (named or bind mounts)
   */
  volumes?: ContainerVolumeConfig[];

  /**
   * Network name (optional - will use project network if not provided)
   */
  networkName?: string;

  /**
   * Network aliases within the network
   */
  networkAliases?: string[];

  /**
   * Working directory inside the container
   */
  workingDir?: string;

  /**
   * User to run as inside the container
   */
  user?: string;

  /**
   * Resource limits
   */
  resources?: ResourceLimits;

  /**
   * Health check configuration
   */
  healthCheck?: ContainerHealthCheckConfig;

  /**
   * Restart policy
   */
  restartPolicy?: RestartPolicy;

  /**
   * Auto-remove container when it exits
   */
  autoRemove?: boolean;
}

/**
 * Volume configuration for container creation
 * Supports both named volumes (Docker managed) and bind mounts (host paths)
 */
export interface ContainerVolumeConfig {
  /**
   * Path inside the container where the volume is mounted
   */
  mountPath: string;

  /**
   * Mount mode - read-write or read-only
   * Default: "RW"
   */
  mode?: "RW" | "RO";

  /**
   * For named volumes: custom volume name (overrides generated name)
   * If specified, a named volume will be created/used
   */
  volumeName?: string;

  /**
   * For bind mounts: host path to mount
   * If specified, binds directly to host path (no volume created)
   * Mutually exclusive with volumeName
   */
  hostPath?: string;
}

export interface ILogService {
  query(filters: {
    projectId?: string;
    deploymentId?: string;
    containerId?: string;
    level?: string;
    since?: Date;
    until?: Date;
    limit?: number;
  }): Promise<
    Array<{
      timestamp: Date;
      level: string;
      message: string;
      source: string;
    }>
  >;
  stream(
    filters: {
      projectId?: string;
      deploymentId?: string;
      containerId?: string;
    },
    callback: (log: unknown) => void
  ): Promise<() => void>; // Returns unsubscribe function
}

export interface IMetricsService {
  query(filters: {
    source?: string;
    metric?: string;
    from: Date;
    to: Date;
    interval?: string;
  }): Promise<
    Array<{
      timestamp: Date;
      metric: string;
      value: number;
      labels?: Record<string, string>;
    }>
  >;
  record(metric: {
    source: string;
    name: string;
    value: number;
    labels?: Record<string, string>;
  }): Promise<void>;
}

export interface ISecretService {
  create(data: {
    projectId?: string;
    key: string;
    value: string;
  }): Promise<{ id: string; key: string }>;
  update(id: string, value: string): Promise<void>;
  delete(id: string): Promise<void>;
  get(id: string): Promise<string>; // Returns decrypted value
  list(projectId?: string): Promise<
    Array<{
      id: string;
      key: string;
      projectId?: string;
    }>
  >;
}
