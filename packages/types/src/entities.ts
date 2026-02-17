export type {
  Project,
  Deployment,
  Container as DbContainer,
  PortMapping as DbPortMapping,
  VolumeMapping as DbVolumeMapping,
  HealthCheckConfig as DbHealthCheckConfig,
  NetworkAttachment as DbNetworkAttachment,
} from "@forge/database";

export type {
  ProjectStatus as DbProjectStatus,
  DeploymentStatus as DbDeploymentStatus,
  ContainerStatus as DbContainerStatus,
  HealthStatus as DbHealthStatus,
  PortProtocol as DbPortProtocol,
  VolumeMode as DbVolumeMode,
} from "@forge/database";

export type {
  Container as DockerContainer,
  ContainerStatus as DockerContainerStatus,
  ContainerConfig,
  ContainerInfo,
  ContainerState,
  ContainerStats,
  PortMapping,
  VolumeMount,
  ResourceLimits,
  HealthCheckConfig as ContainerHealthCheckConfig,
  RestartPolicy,
  Network,
  Volume,
  Image,
  NetworkEndpoint,
  PullOptions,
  BuildOptions,
  HealthCheckResult,
} from "@forge/docker";

export type {
  BuildJobData,
  DeployJobData,
  ScheduledJobData,
  WebhookJobData,
  NotificationJobData,
  BuildJobResult,
  DeployJobResult,
  JobResult,
  JobOptions,
  JobStatus,
  JobInfo,
} from "./jobs";

export interface Service {
  id: string;
  projectId: string;
  name: string;
  type: ServiceType;
  engine?: string;
  version?: string;
  status: ServiceStatus;
  config: Record<string, unknown>;
  connection?: ServiceConnection;
  createdAt: string;
  updatedAt: string;
}

export type ServiceType = "database" | "cache" | "queue" | "storage" | "custom";
export type ServiceStatus = "creating" | "running" | "stopped" | "error";

export interface ServiceConnection {
  host: string;
  port: number;
  url?: string;
  username?: string;
  database?: string;
}

export interface Secret {
  id: string;
  projectId?: string; // null = global secret
  key: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  // value is never returned, only set
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  sourceType: SourceType;
  sourceId: string;
  sourceName: string;
  message: string;
  context?: Record<string, unknown>;
  traceId?: string;
  spanId?: string;
}

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
export type SourceType = "container" | "service" | "system";

export interface Metric {
  id: string;
  timestamp: string;
  sourceType: SourceType;
  sourceId: string;
  sourceName: string;
  metric: string;
  value: number;
  unit?: string;
  labels?: Record<string, string>;
}

export interface Job {
  id: string;
  projectId: string;
  name: string;
  command: string;
  schedule?: string; // cron expression
  status: JobEntityStatus;
  lastRun?: string;
  nextRun?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type JobEntityStatus = "idle" | "running" | "success" | "failed";

export type DeploymentStrategy = "rolling" | "blue-green" | "canary";
export type DeploymentStatus =
  | "pending"
  | "building"
  | "deploying"
  | "running"
  | "failed"
  | "rolled-back";

export type HealthStatus = "healthy" | "unhealthy" | "starting" | "none";
