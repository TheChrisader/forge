import type {
  Project,
  Deployment,
  Container,
  PortMapping,
  VolumeMapping,
  HealthCheckConfig,
  NetworkAttachment,
  User,
  Team,
  TeamMember,
  Role,
  Permission,
  RolePermission,
  RoleAssignment,
  Environment,
  Registry,
  Image,
  Vulnerability,
  DeploymentUrl,
  DeploymentMetrics,
  DeploymentComment,
  ResourceLimit,
  Service,
  ServiceBackup,
  Secret,
  EnvironmentVariable,
  Log,
  BuildLog,
  Metric,
  TracingConfig,
  AlertRule,
  Alert,
  AlertChannel,
  AlertChannelRule,
  AlertNotification,
  Job,
  JobRun,
  Domain,
  NetworkPolicy,
  GitIntegration,
  GitCommit,
  Webhook,
  WebhookDelivery,
  Integration,
  BuildCache,
  ApiKey,
  AuditLog,
} from "./generated/client";

import type {
  ProjectStatus,
  DeploymentStatus,
  ContainerStatus,
  HealthStatus,
  PortProtocol,
  VolumeMode,
  DeploymentStrategy,
  ActiveEnvironment,
  LogLevel,
  SourceType,
  SslStatus,
  GitProvider,
  WebhookEvent,
  TeamRole,
  ServiceType,
  ServiceStatus,
  BackupType,
  BackupStatus,
  RegistryType,
  ScanStatus,
  Severity,
  JobStatus,
  JobRunStatus,
  TriggerType,
  AlertOperator,
  AlertSeverity,
  AlertStatus,
  ChannelType,
  NotificationStatus,
  IntegrationType,
  PolicyAction,
  TracingBackend,
} from "./generated/client";

// ============================================================================
// MODEL TYPES
// ============================================================================

export type {
  Project,
  Deployment,
  Container,
  PortMapping,
  VolumeMapping,
  HealthCheckConfig,
  NetworkAttachment,
  User,
  Team,
  TeamMember,
  Role,
  Permission,
  RolePermission,
  RoleAssignment,
  Environment,
  Registry,
  Image,
  Vulnerability,
  DeploymentUrl,
  DeploymentMetrics,
  DeploymentComment,
  ResourceLimit,
  Service,
  ServiceBackup,
  Secret,
  EnvironmentVariable,
  Log,
  BuildLog,
  Metric,
  TracingConfig,
  AlertRule,
  Alert,
  AlertChannel,
  AlertChannelRule,
  AlertNotification,
  Job,
  JobRun,
  Domain,
  NetworkPolicy,
  GitIntegration,
  GitCommit,
  Webhook,
  WebhookDelivery,
  Integration,
  BuildCache,
  ApiKey,
  AuditLog,
};

// ============================================================================
// ENUM TYPES
// ============================================================================

export type {
  ProjectStatus,
  DeploymentStatus,
  ContainerStatus,
  HealthStatus,
  PortProtocol,
  VolumeMode,
  DeploymentStrategy,
  ActiveEnvironment,
  LogLevel,
  SourceType,
  SslStatus,
  GitProvider,
  WebhookEvent,
  TeamRole,
  ServiceType,
  ServiceStatus,
  BackupType,
  BackupStatus,
  RegistryType,
  ScanStatus,
  Severity,
  JobStatus,
  JobRunStatus,
  TriggerType,
  AlertOperator,
  AlertSeverity,
  AlertStatus,
  ChannelType,
  NotificationStatus,
  IntegrationType,
  PolicyAction,
  TracingBackend,
};

export interface DatabaseConfig {
  url: string;
  pool?: {
    min: number;
    max: number;
  };
}

export interface CreateProjectInput {
  name: string;
  type?: string;
  sourceType?: string;
  sourceUrl?: string;
  status?: ProjectStatus;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export interface UpdateProjectInput {
  name?: string;
  type?: string;
  sourceType?: string;
  sourceUrl?: string;
  status?: ProjectStatus;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  updatedBy?: string;
}

export interface CreateDeploymentInput {
  projectId: string;
  version: string;
  status?: DeploymentStatus;
  buildStartedAt?: Date;
  buildCompletedAt?: Date;
  buildImage?: string;
  buildLogs?: string;
  deployStartedAt?: Date;
  deployCompletedAt?: Date;
  error?: string;
  parentId?: string;
  createdBy?: string;
}

export interface UpdateDeploymentInput {
  version?: string;
  status?: DeploymentStatus;
  buildStartedAt?: Date;
  buildCompletedAt?: Date;
  buildImage?: string;
  buildLogs?: string;
  deployStartedAt?: Date;
  deployCompletedAt?: Date;
  error?: string;
  parentId?: string;
  updatedBy?: string;
}

export interface CreatePortMappingInput {
  containerId: string;
  containerPort: number;
  hostPort?: number;
  protocol?: PortProtocol;
}

export interface CreateVolumeMappingInput {
  containerId: string;
  source: string;
  target: string;
  mode?: VolumeMode;
}

export interface CreateHealthCheckConfigInput {
  containerId: string;
  test: string;
  interval?: number;
  timeout?: number;
  retries?: number;
  startPeriod?: number;
}

export interface CreateNetworkAttachmentInput {
  containerId: string;
  networkName: string;
  ipAddress?: string;
  macAddress?: string;
}

export interface CreateContainerInput {
  projectId: string;
  deploymentId: string;
  name?: string;
  containerId: string;
  image: string;
  status?: ContainerStatus;
  containerNumber?: number;
  config?: Record<string, unknown>;
  env?: Record<string, unknown>;
  healthStatus?: HealthStatus;
  replacedById?: string;
  createdBy?: string;
}

export interface UpdateContainerInput {
  name?: string;
  status?: ContainerStatus;
  config?: Record<string, unknown>;
  env?: Record<string, unknown>;
  healthStatus?: HealthStatus;
  healthChecks?: number;
  healthFails?: number;
  lastHealthCheckAt?: Date;
  startedAt?: Date;
  stoppedAt?: Date;
  deletedAt?: Date;
  updatedBy?: string;
}
