import { z } from "zod";
import {
  IdSchema,
  TimestampSchema,
  NonEmptyStringSchema,
  MetadataSchema,
  ConfigSchema,
  JsonSchema,
  ProjectStatusSchema,
  DeploymentStatusSchema,
  DeploymentStrategySchema,
  ActiveEnvironmentSchema,
  ContainerStatusSchema,
  HealthStatusSchema,
  PortProtocolSchema,
  VolumeModeSchema,
  LogLevelSchema,
  SourceTypeSchema,
  SslStatusSchema,
  GitProviderSchema,
  WebhookEventSchema,
  TeamRoleSchema,
  ServiceTypeSchema,
  ServiceStatusSchema,
  BackupTypeSchema,
  BackupStatusSchema,
  RegistryTypeSchema,
  ScanStatusSchema,
  SeveritySchema,
  JobStatusSchema,
  JobRunStatusSchema,
  TriggerTypeSchema,
  AlertOperatorSchema,
  AlertSeveritySchema,
  AlertStatusSchema,
  ChannelTypeSchema,
  NotificationStatusSchema,
  IntegrationTypeSchema,
  PolicyActionSchema,
  TracingBackendSchema,
} from "./common";

export const UserSchema = z.object({
  id: IdSchema,
  email: NonEmptyStringSchema.max(255),
  name: z.string().max(255).nullable(),
  avatarUrl: z.string().max(500).nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const CreateUserSchema = z.object({
  email: NonEmptyStringSchema.max(255),
  name: z.string().max(255).nullable(),
  avatarUrl: z.string().max(500).nullable(),
});

export const UpdateUserSchema = z.object({
  email: NonEmptyStringSchema.max(255).optional(),
  name: z.string().max(255).nullable().optional(),
  avatarUrl: z.string().max(500).nullable().optional(),
});

export const TeamSchema = z.object({
  id: IdSchema,
  name: NonEmptyStringSchema.max(255),
  slug: NonEmptyStringSchema.max(100),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const CreateTeamSchema = z.object({
  name: NonEmptyStringSchema.max(255),
  slug: NonEmptyStringSchema.max(100),
});

export const UpdateTeamSchema = z.object({
  name: NonEmptyStringSchema.max(255).optional(),
  slug: NonEmptyStringSchema.max(100).optional(),
});

export const TeamMemberSchema = z.object({
  id: IdSchema,
  teamId: IdSchema,
  userId: IdSchema,
  role: TeamRoleSchema.default("MEMBER"),
  createdAt: TimestampSchema,
});

export const CreateTeamMemberSchema = z.object({
  teamId: IdSchema,
  userId: IdSchema,
  role: TeamRoleSchema.optional(),
});

export const UpdateTeamMemberSchema = z.object({
  role: TeamRoleSchema.optional(),
});

export const RoleSchema = z.object({
  id: IdSchema,
  name: NonEmptyStringSchema.max(100),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const CreateRoleSchema = z.object({
  name: NonEmptyStringSchema.max(100),
  description: z.string().nullable(),
  isSystem: z.boolean().optional(),
});

export const UpdateRoleSchema = z.object({
  name: NonEmptyStringSchema.max(100).optional(),
  description: z.string().nullable().optional(),
  isSystem: z.boolean().optional(),
});

export const PermissionSchema = z.object({
  id: IdSchema,
  resource: NonEmptyStringSchema.max(100),
  action: NonEmptyStringSchema.max(100),
  description: z.string().nullable(),
});

export const CreatePermissionSchema = z.object({
  resource: NonEmptyStringSchema.max(100),
  action: NonEmptyStringSchema.max(100),
  description: z.string().nullable(),
});

export const UpdatePermissionSchema = z.object({
  resource: NonEmptyStringSchema.max(100).optional(),
  action: NonEmptyStringSchema.max(100).optional(),
  description: z.string().nullable().optional(),
});

export const RolePermissionSchema = z.object({
  id: IdSchema,
  roleId: IdSchema,
  permissionId: IdSchema,
});

export const CreateRolePermissionSchema = z.object({
  roleId: IdSchema,
  permissionId: IdSchema,
});

export const RoleAssignmentSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  roleId: IdSchema,
  resourceType: z.string().max(100).nullable(),
  resourceId: IdSchema.nullable(),
  createdAt: TimestampSchema,
  createdBy: IdSchema.nullable(),
});

export const CreateRoleAssignmentSchema = z.object({
  userId: IdSchema,
  roleId: IdSchema,
  resourceType: z.string().max(100).nullable(),
  resourceId: IdSchema.nullable(),
  createdBy: IdSchema.nullable(),
});

export const ProjectSchema = z.object({
  id: IdSchema,
  name: NonEmptyStringSchema.max(255),
  teamId: IdSchema.nullable(),
  type: z.string().max(100).nullable(),
  sourceType: z.string().max(100).nullable(),
  sourceUrl: z.string().nullable(),
  status: ProjectStatusSchema,
  config: ConfigSchema,
  metadata: MetadataSchema,
  deletedAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  createdBy: IdSchema.nullable(),
  updatedBy: IdSchema.nullable(),
});

export const CreateProjectSchema = z.object({
  name: NonEmptyStringSchema.max(255),
  teamId: IdSchema.nullable().optional(),
  type: z.string().max(100).nullable().optional(),
  sourceType: z.string().max(100).nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  status: ProjectStatusSchema.optional(),
  config: ConfigSchema.optional(),
  metadata: MetadataSchema.optional(),
  createdBy: IdSchema.nullable().optional(),
});

export const UpdateProjectSchema = z.object({
  name: NonEmptyStringSchema.max(255).optional(),
  teamId: IdSchema.nullable().optional(),
  type: z.string().max(100).nullable().optional(),
  status: ProjectStatusSchema.optional(),
  config: ConfigSchema.optional(),
  metadata: MetadataSchema.optional(),
  deletedAt: TimestampSchema.nullable().optional(),
  updatedBy: IdSchema.nullable().optional(),
});

export const EnvironmentSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  name: NonEmptyStringSchema.max(100),
  slug: NonEmptyStringSchema.max(100),
  isProduction: z.boolean(),
  isDefault: z.boolean(),
  autoDeploy: z.boolean(),
  branch: z.string().max(255).nullable(),
  domain: z.string().max(255).nullable(),
  subdomain: z.string().max(255).nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const CreateEnvironmentSchema = z.object({
  projectId: IdSchema,
  name: NonEmptyStringSchema.max(100),
  slug: NonEmptyStringSchema.max(100),
  isProduction: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  autoDeploy: z.boolean().optional(),
  branch: z.string().max(255).nullable().optional(),
  domain: z.string().max(255).nullable().optional(),
  subdomain: z.string().max(255).nullable().optional(),
});

export const UpdateEnvironmentSchema = z.object({
  name: NonEmptyStringSchema.max(100).optional(),
  slug: NonEmptyStringSchema.max(100).optional(),
  isProduction: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  autoDeploy: z.boolean().optional(),
  branch: z.string().max(255).nullable().optional(),
  domain: z.string().max(255).nullable().optional(),
  subdomain: z.string().max(255).nullable().optional(),
});

export const DeploymentSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  environmentId: IdSchema.nullable(),
  status: DeploymentStatusSchema,
  strategy: DeploymentStrategySchema,
  buildStartedAt: TimestampSchema.nullable(),
  buildCompletedAt: TimestampSchema.nullable(),
  buildImage: z.string().max(500).nullable(),
  deployStartedAt: TimestampSchema.nullable(),
  deployCompletedAt: TimestampSchema.nullable(),
  blueEnvironmentId: IdSchema.nullable(),
  greenEnvironmentId: IdSchema.nullable(),
  activeEnvironment: ActiveEnvironmentSchema.nullable(),
  canaryPercentage: z.number().int().nullable(),
  canaryMetrics: JsonSchema.nullable(),
  canRollback: z.boolean(),
  rolledBackAt: TimestampSchema.nullable(),
  rollbackReason: z.string().nullable(),
  error: z.string().nullable(),
  parentId: IdSchema.nullable(),
  deletedAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  createdBy: IdSchema.nullable(),
  updatedBy: IdSchema.nullable(),
});

export const CreateDeploymentSchema = z.object({
  projectId: IdSchema,
  environmentId: IdSchema.nullable().optional(),
  status: DeploymentStatusSchema.optional(),
  strategy: DeploymentStrategySchema.optional(),
  buildStartedAt: TimestampSchema.nullable().optional(),
  buildCompletedAt: TimestampSchema.nullable().optional(),
  buildImage: z.string().max(500).nullable().optional(),
  deployStartedAt: TimestampSchema.nullable().optional(),
  deployCompletedAt: TimestampSchema.nullable().optional(),
  blueEnvironmentId: IdSchema.nullable().optional(),
  greenEnvironmentId: IdSchema.nullable().optional(),
  activeEnvironment: ActiveEnvironmentSchema.nullable().optional(),
  canaryPercentage: z.number().int().nullable().optional(),
  canaryMetrics: JsonSchema.nullable().optional(),
  canRollback: z.boolean().optional(),
  rolledBackAt: TimestampSchema.nullable().optional(),
  rollbackReason: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  parentId: IdSchema.nullable().optional(),
  createdBy: IdSchema.nullable().optional(),
  updatedBy: IdSchema.nullable().optional(),
});

export const UpdateDeploymentSchema = z.object({
  environmentId: IdSchema.nullable().optional(),
  status: DeploymentStatusSchema.optional(),
  strategy: DeploymentStrategySchema.optional(),
  buildStartedAt: TimestampSchema.nullable().optional(),
  buildCompletedAt: TimestampSchema.nullable().optional(),
  buildImage: z.string().max(500).nullable().optional(),
  deployStartedAt: TimestampSchema.nullable().optional(),
  deployCompletedAt: TimestampSchema.nullable().optional(),
  blueEnvironmentId: IdSchema.nullable().optional(),
  greenEnvironmentId: IdSchema.nullable().optional(),
  activeEnvironment: ActiveEnvironmentSchema.nullable().optional(),
  canaryPercentage: z.number().int().nullable().optional(),
  canaryMetrics: JsonSchema.nullable().optional(),
  canRollback: z.boolean().optional(),
  rolledBackAt: TimestampSchema.nullable().optional(),
  rollbackReason: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  parentId: IdSchema.nullable().optional(),
  deletedAt: TimestampSchema.nullable().optional(),
  updatedBy: IdSchema.nullable().optional(),
});

export const DeploymentUrlSchema = z.object({
  id: IdSchema,
  deploymentId: IdSchema,
  url: NonEmptyStringSchema.max(500),
  isPreview: z.boolean(),
  createdAt: TimestampSchema,
});

export const CreateDeploymentUrlSchema = z.object({
  deploymentId: IdSchema,
  url: NonEmptyStringSchema.max(500),
  isPreview: z.boolean().optional(),
});

export const DeploymentMetricsSchema = z.object({
  id: IdSchema,
  deploymentId: IdSchema,
  buildTime: z.number().int().nullable(),
  deployTime: z.number().int().nullable(),
  bundleSize: z.bigint().nullable(),
  requestCount: z.bigint(),
  errorCount: z.bigint(),
  bandwidth: z.bigint(),
  recordedAt: TimestampSchema,
});

export const DeploymentCommentSchema = z.object({
  id: IdSchema,
  deploymentId: IdSchema,
  userId: IdSchema,
  content: NonEmptyStringSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const CreateDeploymentCommentSchema = z.object({
  deploymentId: IdSchema,
  userId: IdSchema,
  content: NonEmptyStringSchema,
});

export const UpdateDeploymentCommentSchema = z.object({
  content: NonEmptyStringSchema.optional(),
});

export const ContainerSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  deploymentId: IdSchema,
  name: z.string().max(255).nullable(),
  containerId: NonEmptyStringSchema.max(100),
  image: NonEmptyStringSchema.max(500),
  status: ContainerStatusSchema,
  containerNumber: z.number().int().positive(),
  config: ConfigSchema,
  env: JsonSchema.nullable(),
  healthStatus: HealthStatusSchema.nullable(),
  healthChecks: z.number().int().nonnegative(),
  healthFails: z.number().int().nonnegative(),
  lastHealthCheckAt: TimestampSchema.nullable(),
  replacedById: IdSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  startedAt: TimestampSchema.nullable(),
  stoppedAt: TimestampSchema.nullable(),
  deletedAt: TimestampSchema.nullable(),
  createdBy: IdSchema.nullable(),
  updatedBy: IdSchema.nullable(),
});

export const CreateContainerSchema = z.object({
  projectId: IdSchema,
  deploymentId: IdSchema,
  name: z.string().max(255).nullable().optional(),
  containerId: NonEmptyStringSchema.max(100),
  image: NonEmptyStringSchema.max(500),
  status: ContainerStatusSchema.optional(),
  containerNumber: z.number().int().positive().optional(),
  config: ConfigSchema.optional(),
  env: JsonSchema.nullable().optional(),
  healthStatus: HealthStatusSchema.nullable().optional(),
  replacedById: IdSchema.nullable().optional(),
  createdBy: IdSchema.nullable().optional(),
});

export const UpdateContainerSchema = z.object({
  name: z.string().max(255).nullable().optional(),
  status: ContainerStatusSchema.optional(),
  config: ConfigSchema.optional(),
  env: JsonSchema.nullable().optional(),
  healthStatus: HealthStatusSchema.nullable().optional(),
  healthChecks: z.number().int().nonnegative().optional(),
  healthFails: z.number().int().nonnegative().optional(),
  lastHealthCheckAt: TimestampSchema.nullable().optional(),
  startedAt: TimestampSchema.nullable().optional(),
  stoppedAt: TimestampSchema.nullable().optional(),
  deletedAt: TimestampSchema.nullable().optional(),
  updatedBy: IdSchema.nullable().optional(),
});

export const PortMappingSchema = z.object({
  id: IdSchema,
  containerId: IdSchema,
  containerPort: z.number().int().positive(),
  hostPort: z.number().int().positive().nullable(),
  protocol: PortProtocolSchema,
});

export const CreatePortMappingSchema = z.object({
  containerId: IdSchema,
  containerPort: z.number().int().positive(),
  hostPort: z.number().int().positive().nullable().optional(),
  protocol: PortProtocolSchema.optional(),
});

export const VolumeMappingSchema = z.object({
  id: IdSchema,
  containerId: IdSchema,
  source: NonEmptyStringSchema.max(500),
  target: NonEmptyStringSchema.max(500),
  mode: VolumeModeSchema,
});

export const CreateVolumeMappingSchema = z.object({
  containerId: IdSchema,
  source: NonEmptyStringSchema.max(500),
  target: NonEmptyStringSchema.max(500),
  mode: VolumeModeSchema.optional(),
});

export const HealthCheckConfigSchema = z.object({
  id: IdSchema,
  containerId: IdSchema,
  test: NonEmptyStringSchema.max(500),
  interval: z.number().int().positive(),
  timeout: z.number().int().positive(),
  retries: z.number().int().nonnegative(),
  startPeriod: z.number().int().nonnegative(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const CreateHealthCheckConfigSchema = z.object({
  containerId: IdSchema,
  test: NonEmptyStringSchema.max(500),
  interval: z.number().int().positive().optional(),
  timeout: z.number().int().positive().optional(),
  retries: z.number().int().nonnegative().optional(),
  startPeriod: z.number().int().nonnegative().optional(),
});

export const UpdateHealthCheckConfigSchema = z.object({
  test: NonEmptyStringSchema.max(500).optional(),
  interval: z.number().int().positive().optional(),
  timeout: z.number().int().positive().optional(),
  retries: z.number().int().nonnegative().optional(),
  startPeriod: z.number().int().nonnegative().optional(),
});

export const NetworkAttachmentSchema = z.object({
  id: IdSchema,
  containerId: IdSchema,
  networkName: NonEmptyStringSchema.max(255),
  ipAddress: z.string().max(45).nullable(),
  macAddress: z.string().max(17).nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const CreateNetworkAttachmentSchema = z.object({
  containerId: IdSchema,
  networkName: NonEmptyStringSchema.max(255),
  ipAddress: z.string().max(45).nullable().optional(),
  macAddress: z.string().max(17).nullable().optional(),
});

export const UpdateNetworkAttachmentSchema = z.object({
  networkName: NonEmptyStringSchema.max(255).optional(),
  ipAddress: z.string().max(45).nullable().optional(),
  macAddress: z.string().max(17).nullable().optional(),
});

export const ResourceLimitSchema = z.object({
  id: IdSchema,
  containerId: IdSchema,
  cpuRequest: z.number().nullable(),
  memoryRequest: z.bigint().nullable(),
  cpuLimit: z.number().nullable(),
  memoryLimit: z.bigint().nullable(),
  storageLimit: z.bigint().nullable(),
  bandwidthLimit: z.bigint().nullable(),
});

export const CreateResourceLimitSchema = z.object({
  containerId: IdSchema,
  cpuRequest: z.number().nullable().optional(),
  memoryRequest: z.bigint().nullable().optional(),
  cpuLimit: z.number().nullable().optional(),
  memoryLimit: z.bigint().nullable().optional(),
  storageLimit: z.bigint().nullable().optional(),
  bandwidthLimit: z.bigint().nullable().optional(),
});

export const UpdateResourceLimitSchema = z.object({
  cpuRequest: z.number().nullable().optional(),
  memoryRequest: z.bigint().nullable().optional(),
  cpuLimit: z.number().nullable().optional(),
  memoryLimit: z.bigint().nullable().optional(),
  storageLimit: z.bigint().nullable().optional(),
  bandwidthLimit: z.bigint().nullable().optional(),
});

export const RegistrySchema = z.object({
  id: IdSchema,
  name: NonEmptyStringSchema.max(255),
  type: RegistryTypeSchema,
  url: NonEmptyStringSchema.max(500),
  username: z.string().max(255).nullable(),
  passwordSecretId: IdSchema.nullable(),
  tokenSecretId: IdSchema.nullable(),
  isDefault: z.boolean(),
  isPublic: z.boolean(),
  scanOnPush: z.boolean(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const CreateRegistrySchema = z.object({
  name: NonEmptyStringSchema.max(255),
  type: RegistryTypeSchema,
  url: NonEmptyStringSchema.max(500),
  username: z.string().max(255).nullable().optional(),
  passwordSecretId: IdSchema.nullable().optional(),
  tokenSecretId: IdSchema.nullable().optional(),
  isDefault: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  scanOnPush: z.boolean().optional(),
});

export const UpdateRegistrySchema = z.object({
  name: NonEmptyStringSchema.max(255).optional(),
  url: NonEmptyStringSchema.max(500).optional(),
  username: z.string().max(255).nullable().optional(),
  passwordSecretId: IdSchema.nullable().optional(),
  tokenSecretId: IdSchema.nullable().optional(),
  isDefault: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  scanOnPush: z.boolean().optional(),
});

export const ImageSchema = z.object({
  id: IdSchema,
  registryId: IdSchema,
  projectId: IdSchema.nullable(),
  repository: NonEmptyStringSchema.max(500),
  tag: NonEmptyStringSchema.max(255),
  digest: NonEmptyStringSchema.max(100),
  fullName: NonEmptyStringSchema.max(1000),
  size: z.bigint(),
  architecture: NonEmptyStringSchema.max(50),
  os: NonEmptyStringSchema.max(50),
  buildId: IdSchema.nullable(),
  scanStatus: ScanStatusSchema.nullable(),
  scanResults: JsonSchema.nullable(),
  pushedAt: TimestampSchema,
  lastPulledAt: TimestampSchema.nullable(),
});

export const CreateImageSchema = z.object({
  registryId: IdSchema,
  projectId: IdSchema.nullable().optional(),
  repository: NonEmptyStringSchema.max(500),
  tag: NonEmptyStringSchema.max(255),
  digest: NonEmptyStringSchema.max(100),
  fullName: NonEmptyStringSchema.max(1000),
  size: z.bigint(),
  architecture: NonEmptyStringSchema.max(50),
  os: NonEmptyStringSchema.max(50),
  buildId: IdSchema.nullable().optional(),
  scanStatus: ScanStatusSchema.nullable().optional(),
  scanResults: JsonSchema.nullable().optional(),
  lastPulledAt: TimestampSchema.nullable().optional(),
});

export const UpdateImageSchema = z.object({
  projectId: IdSchema.nullable().optional(),
  scanStatus: ScanStatusSchema.nullable().optional(),
  scanResults: JsonSchema.nullable().optional(),
  lastPulledAt: TimestampSchema.nullable().optional(),
});

export const VulnerabilitySchema = z.object({
  id: IdSchema,
  imageId: IdSchema,
  cveId: z.string().max(50).nullable(),
  severity: SeveritySchema,
  package: NonEmptyStringSchema.max(255),
  version: NonEmptyStringSchema.max(100),
  fixAvailable: z.boolean(),
  fixedVersion: z.string().max(100).nullable(),
  description: z.string().nullable(),
  link: z.string().max(500).nullable(),
  detectedAt: TimestampSchema,
});

export const CreateVulnerabilitySchema = z.object({
  imageId: IdSchema,
  cveId: z.string().max(50).nullable().optional(),
  severity: SeveritySchema,
  package: NonEmptyStringSchema.max(255),
  version: NonEmptyStringSchema.max(100),
  fixAvailable: z.boolean().optional(),
  fixedVersion: z.string().max(100).nullable().optional(),
  description: z.string().nullable().optional(),
  link: z.string().max(500).nullable().optional(),
});

export const UpdateVulnerabilitySchema = z.object({
  fixAvailable: z.boolean().optional(),
  fixedVersion: z.string().max(100).nullable().optional(),
  description: z.string().nullable().optional(),
  link: z.string().max(500).nullable().optional(),
});

export const ServiceSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  name: NonEmptyStringSchema.max(255),
  type: ServiceTypeSchema,
  engine: z.string().max(100).nullable(),
  status: ServiceStatusSchema,
  config: ConfigSchema,
  connectionHost: z.string().max(255).nullable(),
  connectionPort: z.number().int().positive().nullable(),
  connectionUrl: z.string().nullable(),
  connectionUsername: z.string().max(255).nullable(),
  connectionPassword: z.string().nullable(),
  connectionDatabase: z.string().max(255).nullable(),
  version: z.string().max(50).nullable(),
  internalHostname: z.string().max(255).nullable(),
  volumeName: z.string().max(255).nullable(),
  containerId: z.string().max(100).nullable(),
  resourcesAllocated: JsonSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  createdBy: IdSchema.nullable(),
  deletedAt: TimestampSchema.nullable(),
});

export const CreateServiceSchema = z.object({
  projectId: IdSchema,
  name: NonEmptyStringSchema.max(255),
  type: ServiceTypeSchema,
  engine: z.string().max(100).nullable().optional(),
  status: ServiceStatusSchema.optional(),
  config: ConfigSchema.optional(),
  connectionHost: z.string().max(255).nullable().optional(),
  connectionPort: z.number().int().positive().nullable().optional(),
  connectionUrl: z.string().nullable().optional(),
  connectionUsername: z.string().max(255).nullable().optional(),
  connectionPassword: z.string().nullable().optional(),
  connectionDatabase: z.string().max(255).nullable().optional(),
  resourcesAllocated: JsonSchema.nullable().optional(),
  createdBy: IdSchema.nullable().optional(),
});

export const UpdateServiceSchema = z.object({
  name: NonEmptyStringSchema.max(255).optional(),
  engine: z.string().max(100).nullable().optional(),
  status: ServiceStatusSchema.optional(),
  config: ConfigSchema.optional(),
  connectionHost: z.string().max(255).nullable().optional(),
  connectionPort: z.number().int().positive().nullable().optional(),
  connectionUrl: z.string().nullable().optional(),
  connectionUsername: z.string().max(255).nullable().optional(),
  connectionPassword: z.string().nullable().optional(),
  connectionDatabase: z.string().max(255).nullable().optional(),
  resourcesAllocated: JsonSchema.nullable().optional(),
  deletedAt: TimestampSchema.nullable().optional(),
});

export const ServiceBackupSchema = z.object({
  id: IdSchema,
  serviceId: IdSchema,
  type: BackupTypeSchema,
  path: NonEmptyStringSchema.max(500),
  size: z.bigint(),
  status: BackupStatusSchema,
  startedAt: TimestampSchema.nullable(),
  completedAt: TimestampSchema.nullable(),
  metadata: JsonSchema.nullable(),
  error: z.string().nullable(),
  createdAt: TimestampSchema,
  createdBy: IdSchema.nullable(),
});

export const CreateServiceBackupSchema = z.object({
  serviceId: IdSchema,
  type: BackupTypeSchema,
  path: NonEmptyStringSchema.max(500),
  size: z.bigint(),
  status: BackupStatusSchema.optional(),
  startedAt: TimestampSchema.nullable().optional(),
  completedAt: TimestampSchema.nullable().optional(),
  metadata: JsonSchema.nullable().optional(),
  error: z.string().nullable().optional(),
  createdBy: IdSchema.nullable().optional(),
});

export const UpdateServiceBackupSchema = z.object({
  status: BackupStatusSchema.optional(),
  startedAt: TimestampSchema.nullable().optional(),
  completedAt: TimestampSchema.nullable().optional(),
  metadata: JsonSchema.nullable().optional(),
  error: z.string().nullable().optional(),
});

// Engine catalog response schemas
export const EngineVersionSchema = z.object({
  version: z.string(),
  imageTag: z.string(),
  minMemoryMB: z.number().optional(),
  deprecated: z.boolean().optional(),
});

export const ConfigParameterSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(["integer", "string", "boolean"]),
  defaultValue: z.string(),
  envMapping: z.string(),
  description: z.string(),
});

export const EngineDetailSchema = z.object({
  type: ServiceTypeSchema,
  engine: z.string(),
  displayName: z.string(),
  description: z.string(),
  icon: z.string(),
  supportedVersions: z.array(EngineVersionSchema),
  defaultVersion: z.string(),
  defaultPort: z.number(),
  configParameters: z.array(ConfigParameterSchema),
});

export const ServiceConnectionSchema = z.object({
  host: z.string().nullable(),
  port: z.number().nullable(),
  url: z.string().nullable(),
  username: z.string().nullable(),
  password: z.string().nullable(),
  database: z.string().nullable(),
  envVars: z.record(z.string(), z.string()).optional(),
});

export const SecretSchema = z.object({
  id: IdSchema,
  projectId: IdSchema.nullable(),
  key: NonEmptyStringSchema.max(255),
  encryptedValue: NonEmptyStringSchema,
  encryptionKeyId: NonEmptyStringSchema.max(100),
  description: z.string().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  createdBy: IdSchema.nullable(),
  updatedBy: IdSchema.nullable(),
  lastAccessedAt: TimestampSchema.nullable(),
  accessCount: z.number().int().nonnegative(),
  deletedAt: TimestampSchema.nullable(),
});

export const CreateSecretSchema = z.object({
  projectId: IdSchema.nullable().optional(),
  key: NonEmptyStringSchema.max(255),
  encryptedValue: NonEmptyStringSchema,
  encryptionKeyId: NonEmptyStringSchema.max(100),
  description: z.string().nullable().optional(),
  createdBy: IdSchema.nullable().optional(),
});

export const UpdateSecretSchema = z.object({
  key: NonEmptyStringSchema.max(255).optional(),
  encryptedValue: NonEmptyStringSchema.optional(),
  description: z.string().nullable().optional(),
  updatedBy: IdSchema.nullable().optional(),
  deletedAt: TimestampSchema.nullable().optional(),
});

export const EnvironmentVariableSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  environmentId: IdSchema.nullable(),
  key: NonEmptyStringSchema.max(255),
  value: NonEmptyStringSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const CreateEnvironmentVariableSchema = z.object({
  projectId: IdSchema,
  environmentId: IdSchema.nullable().optional(),
  key: NonEmptyStringSchema.max(255),
  value: NonEmptyStringSchema,
});

export const UpdateEnvironmentVariableSchema = z.object({
  key: NonEmptyStringSchema.max(255).optional(),
  value: NonEmptyStringSchema.optional(),
  environmentId: IdSchema.nullable().optional(),
});

export const LogSchema = z.object({
  id: IdSchema,
  timestamp: TimestampSchema,
  sourceType: SourceTypeSchema,
  sourceId: IdSchema,
  sourceName: NonEmptyStringSchema.max(255),
  level: LogLevelSchema,
  message: NonEmptyStringSchema,
  context: JsonSchema.nullable(),
  traceId: z.string().max(100).nullable(),
  spanId: z.string().max(100).nullable(),
  projectId: IdSchema.nullable(),
  deploymentId: IdSchema.nullable(),
  containerId: IdSchema.nullable(),
  serviceId: IdSchema.nullable(),
});

export const CreateLogSchema = z.object({
  sourceType: SourceTypeSchema,
  sourceId: IdSchema,
  sourceName: NonEmptyStringSchema.max(255),
  level: LogLevelSchema,
  message: NonEmptyStringSchema,
  context: JsonSchema.nullable().optional(),
  traceId: z.string().max(100).nullable().optional(),
  spanId: z.string().max(100).nullable().optional(),
  projectId: IdSchema.nullable().optional(),
  deploymentId: IdSchema.nullable().optional(),
  containerId: IdSchema.nullable().optional(),
  serviceId: IdSchema.nullable().optional(),
});

import { BuildLogSourceSchema } from "./common";

export const BuildLogSchema = z.object({
  id: IdSchema,
  deploymentId: IdSchema,
  lineNumber: z.number().int().nonnegative(),
  timestamp: TimestampSchema,
  message: NonEmptyStringSchema,
  level: LogLevelSchema,
  source: BuildLogSourceSchema,
});

export const CreateBuildLogSchema = z.object({
  deploymentId: IdSchema,
  lineNumber: z.number().int().nonnegative(),
  message: NonEmptyStringSchema,
  level: LogLevelSchema.optional(),
  source: BuildLogSourceSchema.optional(),
});

export const MetricSchema = z.object({
  id: IdSchema,
  timestamp: TimestampSchema,
  sourceType: SourceTypeSchema,
  sourceId: IdSchema,
  sourceName: NonEmptyStringSchema.max(255),
  metric: NonEmptyStringSchema.max(255),
  value: z.number(),
  unit: z.string().max(50).nullable(),
  labels: JsonSchema.nullable(),
  projectId: IdSchema.nullable(),
  containerId: IdSchema.nullable(),
  serviceId: IdSchema.nullable(),
  deploymentId: IdSchema.nullable(),
});

export const CreateMetricSchema = z.object({
  sourceType: SourceTypeSchema,
  sourceId: IdSchema,
  sourceName: NonEmptyStringSchema.max(255),
  metric: NonEmptyStringSchema.max(255),
  value: z.number(),
  unit: z.string().max(50).nullable().optional(),
  labels: JsonSchema.nullable().optional(),
  projectId: IdSchema.nullable().optional(),
  containerId: IdSchema.nullable().optional(),
  serviceId: IdSchema.nullable().optional(),
  deploymentId: IdSchema.nullable().optional(),
});

export const TracingConfigSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  enabled: z.boolean(),
  backend: TracingBackendSchema,
  endpoint: NonEmptyStringSchema.max(500),
  sampleRate: z.number(),
  captureHeaders: z.array(z.string()),
  autoInstrument: z.boolean(),
});

export const CreateTracingConfigSchema = z.object({
  projectId: IdSchema,
  enabled: z.boolean().optional(),
  backend: TracingBackendSchema,
  endpoint: NonEmptyStringSchema.max(500),
  sampleRate: z.number().optional(),
  captureHeaders: z.array(z.string()).optional(),
  autoInstrument: z.boolean().optional(),
});

export const UpdateTracingConfigSchema = z.object({
  enabled: z.boolean().optional(),
  backend: TracingBackendSchema.optional(),
  endpoint: NonEmptyStringSchema.max(500).optional(),
  sampleRate: z.number().optional(),
  captureHeaders: z.array(z.string()).optional(),
  autoInstrument: z.boolean().optional(),
});

export const AlertRuleSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  name: NonEmptyStringSchema.max(255),
  description: z.string().nullable(),
  metric: NonEmptyStringSchema.max(255),
  operator: AlertOperatorSchema,
  threshold: z.number(),
  duration: z.number().int().nonnegative(),
  severity: AlertSeveritySchema,
  sourceType: SourceTypeSchema.nullable(),
  sourceId: IdSchema.nullable(),
  enabled: z.boolean(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  createdBy: IdSchema.nullable(),
});

export const CreateAlertRuleSchema = z.object({
  projectId: IdSchema,
  name: NonEmptyStringSchema.max(255),
  description: z.string().nullable().optional(),
  metric: NonEmptyStringSchema.max(255),
  operator: AlertOperatorSchema,
  threshold: z.number(),
  duration: z.number().int().nonnegative(),
  severity: AlertSeveritySchema,
  sourceType: SourceTypeSchema.nullable().optional(),
  sourceId: IdSchema.nullable().optional(),
  enabled: z.boolean().optional(),
  createdBy: IdSchema.nullable().optional(),
});

export const UpdateAlertRuleSchema = z.object({
  name: NonEmptyStringSchema.max(255).optional(),
  description: z.string().nullable().optional(),
  metric: NonEmptyStringSchema.max(255).optional(),
  operator: AlertOperatorSchema.optional(),
  threshold: z.number().optional(),
  duration: z.number().int().nonnegative().optional(),
  severity: AlertSeveritySchema.optional(),
  sourceType: SourceTypeSchema.nullable().optional(),
  sourceId: IdSchema.nullable().optional(),
  enabled: z.boolean().optional(),
});

export const AlertSchema = z.object({
  id: IdSchema,
  ruleId: IdSchema,
  status: AlertStatusSchema,
  severity: AlertSeveritySchema,
  value: z.number(),
  message: NonEmptyStringSchema,
  firedAt: TimestampSchema,
  resolvedAt: TimestampSchema.nullable(),
  acknowledgedAt: TimestampSchema.nullable(),
  acknowledgedBy: IdSchema.nullable(),
});

export const CreateAlertSchema = z.object({
  ruleId: IdSchema,
  status: AlertStatusSchema.optional(),
  severity: AlertSeveritySchema,
  value: z.number(),
  message: NonEmptyStringSchema,
  resolvedAt: TimestampSchema.nullable().optional(),
  acknowledgedAt: TimestampSchema.nullable().optional(),
  acknowledgedBy: IdSchema.nullable().optional(),
});

export const UpdateAlertSchema = z.object({
  status: AlertStatusSchema.optional(),
  severity: AlertSeveritySchema.optional(),
  value: z.number().optional(),
  message: NonEmptyStringSchema.optional(),
  resolvedAt: TimestampSchema.nullable().optional(),
  acknowledgedAt: TimestampSchema.nullable().optional(),
  acknowledgedBy: IdSchema.nullable().optional(),
});

export const AlertChannelSchema = z.object({
  id: IdSchema,
  projectId: IdSchema.nullable(),
  name: NonEmptyStringSchema.max(255),
  type: ChannelTypeSchema,
  config: ConfigSchema,
  enabled: z.boolean(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const CreateAlertChannelSchema = z.object({
  projectId: IdSchema.nullable().optional(),
  name: NonEmptyStringSchema.max(255),
  type: ChannelTypeSchema,
  config: ConfigSchema,
  enabled: z.boolean().optional(),
});

export const UpdateAlertChannelSchema = z.object({
  name: NonEmptyStringSchema.max(255).optional(),
  type: ChannelTypeSchema.optional(),
  config: ConfigSchema.optional(),
  enabled: z.boolean().optional(),
});

export const AlertChannelRuleSchema = z.object({
  id: IdSchema,
  ruleId: IdSchema,
  channelId: IdSchema,
  severities: z.array(AlertSeveritySchema),
});

export const CreateAlertChannelRuleSchema = z.object({
  ruleId: IdSchema,
  channelId: IdSchema,
  severities: z.array(AlertSeveritySchema),
});

export const UpdateAlertChannelRuleSchema = z.object({
  severities: z.array(AlertSeveritySchema).optional(),
});

export const AlertNotificationSchema = z.object({
  id: IdSchema,
  timestamp: TimestampSchema,
  alertId: IdSchema,
  channelId: IdSchema,
  status: NotificationStatusSchema,
  sentAt: TimestampSchema.nullable(),
  error: z.string().nullable(),
});

export const CreateAlertNotificationSchema = z.object({
  timestamp: TimestampSchema.optional(),
  alertId: IdSchema,
  channelId: IdSchema,
  status: NotificationStatusSchema.optional(),
  sentAt: TimestampSchema.nullable().optional(),
  error: z.string().nullable().optional(),
});

export const UpdateAlertNotificationSchema = z.object({
  timestamp: TimestampSchema.optional(),
  status: NotificationStatusSchema.optional(),
  sentAt: TimestampSchema.nullable().optional(),
  error: z.string().nullable().optional(),
});

export const JobSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  name: NonEmptyStringSchema.max(255),
  description: z.string().nullable(),
  command: NonEmptyStringSchema,
  schedule: z.string().max(100).nullable(),
  status: JobStatusSchema,
  enabled: z.boolean(),
  lastRunAt: TimestampSchema.nullable(),
  lastRunStatus: JobRunStatusSchema.nullable(),
  nextRunAt: TimestampSchema.nullable(),
  timeout: z.number().int().nonnegative().nullable(),
  retries: z.number().int().nonnegative(),
  retryDelay: z.number().int().nonnegative(),
  env: JsonSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  createdBy: IdSchema.nullable(),
  deletedAt: TimestampSchema.nullable(),
});

export const CreateJobSchema = z.object({
  projectId: IdSchema,
  name: NonEmptyStringSchema.max(255),
  description: z.string().nullable().optional(),
  command: NonEmptyStringSchema,
  schedule: z.string().max(100).nullable().optional(),
  status: JobStatusSchema.optional(),
  enabled: z.boolean().optional(),
  timeout: z.number().int().nonnegative().optional(),
  retries: z.number().int().nonnegative().optional(),
  retryDelay: z.number().int().nonnegative().optional(),
  env: JsonSchema.nullable().optional(),
  createdBy: IdSchema.nullable().optional(),
});

export const UpdateJobSchema = z.object({
  name: NonEmptyStringSchema.max(255).optional(),
  description: z.string().nullable().optional(),
  command: NonEmptyStringSchema.optional(),
  schedule: z.string().max(100).nullable().optional(),
  status: JobStatusSchema.optional(),
  enabled: z.boolean().optional(),
  timeout: z.number().int().nonnegative().optional(),
  retries: z.number().int().nonnegative().optional(),
  retryDelay: z.number().int().nonnegative().optional(),
  env: JsonSchema.nullable().optional(),
  deletedAt: TimestampSchema.nullable().optional(),
});

export const JobRunSchema = z.object({
  id: IdSchema,
  jobId: IdSchema,
  status: JobRunStatusSchema,
  startedAt: TimestampSchema,
  completedAt: TimestampSchema.nullable(),
  output: z.string().nullable(),
  error: z.string().nullable(),
  exitCode: z.number().int().nullable(),
  triggeredBy: TriggerTypeSchema,
});

export const CreateJobRunSchema = z.object({
  jobId: IdSchema,
  status: JobRunStatusSchema.optional(),
  startedAt: TimestampSchema.optional(),
  completedAt: TimestampSchema.nullable().optional(),
  output: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  exitCode: z.number().int().nullable().optional(),
  triggeredBy: TriggerTypeSchema,
});

export const UpdateJobRunSchema = z.object({
  status: JobRunStatusSchema.optional(),
  completedAt: TimestampSchema.nullable().optional(),
  output: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  exitCode: z.number().int().nullable().optional(),
});

export const DomainSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  domain: NonEmptyStringSchema.max(255),
  verified: z.boolean(),
  verificationToken: z.string().max(100).nullable(),
  isPrimary: z.boolean(),
  sslStatus: SslStatusSchema,
  sslIssuedAt: TimestampSchema.nullable(),
  sslExpiresAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const CreateDomainSchema = z.object({
  projectId: IdSchema,
  domain: NonEmptyStringSchema.max(255),
  verified: z.boolean().optional(),
  verificationToken: z.string().max(100).nullable().optional(),
  isPrimary: z.boolean().optional(),
  sslStatus: SslStatusSchema.optional(),
  sslIssuedAt: TimestampSchema.nullable().optional(),
  sslExpiresAt: TimestampSchema.nullable().optional(),
});

export const UpdateDomainSchema = z.object({
  domain: NonEmptyStringSchema.max(255).optional(),
  verified: z.boolean().optional(),
  verificationToken: z.string().max(100).nullable().optional(),
  isPrimary: z.boolean().optional(),
  sslStatus: SslStatusSchema.optional(),
  sslIssuedAt: TimestampSchema.nullable().optional(),
  sslExpiresAt: TimestampSchema.nullable().optional(),
});

export const NetworkPolicySchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  name: NonEmptyStringSchema.max(255),
  description: z.string().nullable(),
  sourceSelector: ConfigSchema,
  targetSelector: ConfigSchema,
  action: PolicyActionSchema,
  protocol: z.string().max(50).nullable(),
  ports: z.array(z.number().int()),
  enabled: z.boolean(),
  priority: z.number().int(),
  createdAt: TimestampSchema,
});

export const CreateNetworkPolicySchema = z.object({
  projectId: IdSchema,
  name: NonEmptyStringSchema.max(255),
  description: z.string().nullable().optional(),
  sourceSelector: ConfigSchema,
  targetSelector: ConfigSchema,
  action: PolicyActionSchema,
  protocol: z.string().max(50).nullable().optional(),
  ports: z.array(z.number().int()),
  enabled: z.boolean().optional(),
  priority: z.number().int().optional(),
});

export const UpdateNetworkPolicySchema = z.object({
  name: NonEmptyStringSchema.max(255).optional(),
  description: z.string().nullable().optional(),
  sourceSelector: ConfigSchema.optional(),
  targetSelector: ConfigSchema.optional(),
  action: PolicyActionSchema.optional(),
  protocol: z.string().max(50).nullable().optional(),
  ports: z.array(z.number().int()).optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().optional(),
});

export const GitIntegrationSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  provider: GitProviderSchema,
  repository: NonEmptyStringSchema.max(255),
  branch: NonEmptyStringSchema.max(255),
  installationId: z.string().max(100).nullable(),
  autoDeploy: z.boolean(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const CreateGitIntegrationSchema = z.object({
  projectId: IdSchema,
  provider: GitProviderSchema,
  repository: NonEmptyStringSchema.max(255),
  branch: NonEmptyStringSchema.max(255).optional(),
  installationId: z.string().max(100).nullable().optional(),
  autoDeploy: z.boolean().optional(),
});

export const UpdateGitIntegrationSchema = z.object({
  provider: GitProviderSchema.optional(),
  repository: NonEmptyStringSchema.max(255).optional(),
  branch: NonEmptyStringSchema.max(255).optional(),
  installationId: z.string().max(100).nullable().optional(),
  autoDeploy: z.boolean().optional(),
});

export const GitCommitSchema = z.object({
  id: IdSchema,
  deploymentId: IdSchema,
  sha: NonEmptyStringSchema.max(40),
  message: NonEmptyStringSchema,
  author: NonEmptyStringSchema.max(255),
  branch: NonEmptyStringSchema.max(255),
  createdAt: TimestampSchema,
});

export const CreateGitCommitSchema = z.object({
  deploymentId: IdSchema,
  sha: NonEmptyStringSchema.max(40),
  message: NonEmptyStringSchema,
  author: NonEmptyStringSchema.max(255),
  branch: NonEmptyStringSchema.max(255),
});

export const UpdateGitCommitSchema = z.object({
  sha: NonEmptyStringSchema.max(40).optional(),
  message: NonEmptyStringSchema.optional(),
  author: NonEmptyStringSchema.max(255).optional(),
  branch: NonEmptyStringSchema.max(255).optional(),
});

export const WebhookSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  url: NonEmptyStringSchema.max(500),
  secret: NonEmptyStringSchema.max(255),
  events: z.array(WebhookEventSchema),
  enabled: z.boolean(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const CreateWebhookSchema = z.object({
  projectId: IdSchema,
  url: NonEmptyStringSchema.max(500),
  secret: NonEmptyStringSchema.max(255),
  events: z.array(WebhookEventSchema),
  enabled: z.boolean().optional(),
});

export const UpdateWebhookSchema = z.object({
  url: NonEmptyStringSchema.max(500).optional(),
  secret: NonEmptyStringSchema.max(255).optional(),
  events: z.array(WebhookEventSchema).optional(),
  enabled: z.boolean().optional(),
});

export const WebhookDeliverySchema = z.object({
  id: IdSchema,
  webhookId: IdSchema,
  event: WebhookEventSchema,
  payload: ConfigSchema,
  statusCode: z.number().int().nullable(),
  response: z.string().nullable(),
  error: z.string().nullable(),
  deliveredAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
});

export const CreateWebhookDeliverySchema = z.object({
  webhookId: IdSchema,
  event: WebhookEventSchema,
  payload: ConfigSchema,
  statusCode: z.number().int().nullable().optional(),
  response: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  deliveredAt: TimestampSchema.nullable().optional(),
});

export const UpdateWebhookDeliverySchema = z.object({
  statusCode: z.number().int().nullable().optional(),
  response: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  deliveredAt: TimestampSchema.nullable().optional(),
});

export const IntegrationSchema = z.object({
  id: IdSchema,
  projectId: IdSchema.nullable(),
  type: IntegrationTypeSchema,
  name: NonEmptyStringSchema.max(255),
  config: ConfigSchema,
  enabled: z.boolean(),
  accessToken: z.string().nullable(),
  refreshToken: z.string().nullable(),
  tokenExpiresAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const CreateIntegrationSchema = z.object({
  projectId: IdSchema.nullable().optional(),
  type: IntegrationTypeSchema,
  name: NonEmptyStringSchema.max(255),
  config: ConfigSchema,
  enabled: z.boolean().optional(),
  accessToken: z.string().nullable().optional(),
  refreshToken: z.string().nullable().optional(),
  tokenExpiresAt: TimestampSchema.nullable().optional(),
});

export const UpdateIntegrationSchema = z.object({
  type: IntegrationTypeSchema.optional(),
  name: NonEmptyStringSchema.max(255).optional(),
  config: ConfigSchema.optional(),
  enabled: z.boolean().optional(),
  accessToken: z.string().nullable().optional(),
  refreshToken: z.string().nullable().optional(),
  tokenExpiresAt: TimestampSchema.nullable().optional(),
});

export const BuildCacheSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  key: NonEmptyStringSchema.max(255),
  path: NonEmptyStringSchema.max(500),
  size: z.bigint(),
  createdAt: TimestampSchema,
  expiresAt: TimestampSchema,
  lastUsedAt: TimestampSchema,
});

export const CreateBuildCacheSchema = z.object({
  projectId: IdSchema,
  key: NonEmptyStringSchema.max(255),
  path: NonEmptyStringSchema.max(500),
  size: z.bigint(),
  expiresAt: TimestampSchema,
  lastUsedAt: TimestampSchema.optional(),
});

export const UpdateBuildCacheSchema = z.object({
  key: NonEmptyStringSchema.max(255).optional(),
  path: NonEmptyStringSchema.max(500).optional(),
  size: z.bigint().optional(),
  expiresAt: TimestampSchema.optional(),
  lastUsedAt: TimestampSchema.optional(),
});

export const ApiKeySchema = z.object({
  id: IdSchema,
  userId: IdSchema.nullable(),
  projectId: IdSchema.nullable(),
  name: NonEmptyStringSchema.max(255),
  keyHash: NonEmptyStringSchema.max(255),
  prefix: NonEmptyStringSchema.max(20),
  scopes: z.array(z.string()),
  rateLimit: z.number().int().nullable(),
  lastUsedAt: TimestampSchema.nullable(),
  usageCount: z.bigint(),
  expiresAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  revokedAt: TimestampSchema.nullable(),
});

export const CreateApiKeySchema = z.object({
  userId: IdSchema.nullable().optional(),
  projectId: IdSchema.nullable().optional(),
  name: NonEmptyStringSchema.max(255),
  keyHash: NonEmptyStringSchema.max(255),
  prefix: NonEmptyStringSchema.max(20),
  scopes: z.array(z.string()).optional(),
  rateLimit: z.number().int().nullable().optional(),
  expiresAt: TimestampSchema.nullable().optional(),
});

export const UpdateApiKeySchema = z.object({
  name: NonEmptyStringSchema.max(255).optional(),
  scopes: z.array(z.string()).optional(),
  rateLimit: z.number().int().nullable().optional(),
  expiresAt: TimestampSchema.nullable().optional(),
  revokedAt: TimestampSchema.nullable().optional(),
});

export const AuditLogSchema = z.object({
  id: IdSchema,
  userId: IdSchema.nullable(),
  userEmail: z.string().max(255).nullable(),
  ipAddress: z.string().max(45).nullable(),
  userAgent: z.string().nullable(),
  action: NonEmptyStringSchema.max(100),
  resourceType: NonEmptyStringSchema.max(100),
  resourceId: IdSchema.nullable(),
  changes: JsonSchema.nullable(),
  metadata: JsonSchema.nullable(),
  timestamp: TimestampSchema,
  projectId: IdSchema.nullable(),
  teamId: IdSchema.nullable(),
});

export const CreateAuditLogSchema = z.object({
  userId: IdSchema.nullable().optional(),
  userEmail: z.string().max(255).nullable().optional(),
  ipAddress: z.string().max(45).nullable().optional(),
  userAgent: z.string().nullable().optional(),
  action: NonEmptyStringSchema.max(100),
  resourceType: NonEmptyStringSchema.max(100),
  resourceId: IdSchema.nullable().optional(),
  changes: JsonSchema.nullable().optional(),
  metadata: JsonSchema.nullable().optional(),
  projectId: IdSchema.nullable().optional(),
  teamId: IdSchema.nullable().optional(),
});

export const ProjectWithRelationsSchema = ProjectSchema.extend({
  team: z
    .lazy(() => TeamSchema)
    .nullable()
    .optional(),
  deployments: z.array(z.lazy(() => DeploymentSchema)).optional(),
  containers: z.array(z.lazy(() => ContainerSchema)).optional(),
  environments: z.array(z.lazy(() => EnvironmentSchema)).optional(),
  domains: z.array(z.lazy(() => DomainSchema)).optional(),
  environmentVars: z.array(z.lazy(() => EnvironmentVariableSchema)).optional(),
  gitIntegration: z
    .lazy(() => GitIntegrationSchema)
    .nullable()
    .optional(),
  webhooks: z.array(z.lazy(() => WebhookSchema)).optional(),
  buildCaches: z.array(z.lazy(() => BuildCacheSchema)).optional(),
  services: z.array(z.lazy(() => ServiceSchema)).optional(),
  secrets: z.array(z.lazy(() => SecretSchema)).optional(),
  jobs: z.array(z.lazy(() => JobSchema)).optional(),
  images: z.array(z.lazy(() => ImageSchema)).optional(),
  alertRules: z.array(z.lazy(() => AlertRuleSchema)).optional(),
  alertChannels: z.array(z.lazy(() => AlertChannelSchema)).optional(),
  integrations: z.array(z.lazy(() => IntegrationSchema)).optional(),
  networkPolicies: z.array(z.lazy(() => NetworkPolicySchema)).optional(),
  tracingConfig: z
    .lazy(() => TracingConfigSchema)
    .nullable()
    .optional(),
});

export const EnvironmentWithRelationsSchema = EnvironmentSchema.extend({
  project: z.lazy(() => ProjectSchema).optional(),
  deployments: z.array(z.lazy(() => DeploymentSchema)).optional(),
  variables: z.array(z.lazy(() => EnvironmentVariableSchema)).optional(),
});

export const DeploymentWithRelationsSchema = DeploymentSchema.extend({
  project: z.lazy(() => ProjectSchema).optional(),
  environment: z
    .lazy(() => EnvironmentSchema)
    .nullable()
    .optional(),
  containers: z.array(z.lazy(() => ContainerSchema)).optional(),
  parent: z
    .lazy(() => DeploymentSchema)
    .nullable()
    .optional(),
  children: z.array(z.lazy(() => DeploymentSchema)).optional(),
  buildLogs: z.array(z.lazy(() => BuildLogSchema)).optional(),
  urls: z.array(z.lazy(() => DeploymentUrlSchema)).optional(),
  gitCommit: z
    .lazy(() => GitCommitSchema)
    .nullable()
    .optional(),
  metrics: z.array(z.lazy(() => DeploymentMetricsSchema)).optional(),
  comments: z.array(z.lazy(() => DeploymentCommentSchema)).optional(),
});

export const ContainerWithRelationsSchema = ContainerSchema.extend({
  project: z.lazy(() => ProjectSchema).optional(),
  deployment: z.lazy(() => DeploymentSchema).optional(),
  ports: z.array(z.lazy(() => PortMappingSchema)).optional(),
  volumes: z.array(z.lazy(() => VolumeMappingSchema)).optional(),
  healthCheckConfig: z
    .lazy(() => HealthCheckConfigSchema)
    .nullable()
    .optional(),
  networkAttachments: z.array(z.lazy(() => NetworkAttachmentSchema)).optional(),
  resourceLimit: z
    .lazy(() => ResourceLimitSchema)
    .nullable()
    .optional(),
  replacedBy: z
    .lazy(() => ContainerSchema)
    .nullable()
    .optional(),
  replaces: z.array(z.lazy(() => ContainerSchema)).optional(),
});

export const ServiceWithRelationsSchema = ServiceSchema.extend({
  project: z.lazy(() => ProjectSchema).optional(),
  backups: z.array(z.lazy(() => ServiceBackupSchema)).optional(),
  _count: z
    .object({
      backups: z.number(),
    })
    .optional(),
});

export const ImageWithRelationsSchema = ImageSchema.extend({
  registry: z.lazy(() => RegistrySchema).optional(),
  project: z
    .lazy(() => ProjectSchema)
    .nullable()
    .optional(),
  vulnerabilities: z.array(z.lazy(() => VulnerabilitySchema)).optional(),
});

export const RegistryWithRelationsSchema = RegistrySchema.extend({
  images: z.array(z.lazy(() => ImageSchema)).optional(),
  passwordSecret: z
    .lazy(() => SecretSchema)
    .nullable()
    .optional(),
  tokenSecret: z
    .lazy(() => SecretSchema)
    .nullable()
    .optional(),
});

export const AlertRuleWithRelationsSchema = AlertRuleSchema.extend({
  project: z.lazy(() => ProjectSchema).optional(),
  alerts: z.array(z.lazy(() => AlertSchema)).optional(),
  channels: z.array(z.lazy(() => AlertChannelRuleSchema)).optional(),
});

export const AlertChannelWithRelationsSchema = AlertChannelSchema.extend({
  project: z
    .lazy(() => ProjectSchema)
    .nullable()
    .optional(),
  rules: z.array(z.lazy(() => AlertChannelRuleSchema)).optional(),
  notifications: z.array(z.lazy(() => AlertNotificationSchema)).optional(),
});

export const JobWithRelationsSchema = JobSchema.extend({
  project: z.lazy(() => ProjectSchema).optional(),
  runs: z.array(z.lazy(() => JobRunSchema)).optional(),
});

export const TeamWithRelationsSchema = TeamSchema.extend({
  members: z.array(z.lazy(() => TeamMemberSchema)).optional(),
  projects: z.array(z.lazy(() => ProjectSchema)).optional(),
});

export const TeamMemberWithRelationsSchema = TeamMemberSchema.extend({
  team: z.lazy(() => TeamSchema).optional(),
  user: z.lazy(() => UserSchema).optional(),
});

export const WebhookWithRelationsSchema = WebhookSchema.extend({
  project: z.lazy(() => ProjectSchema).optional(),
  deliveries: z.array(z.lazy(() => WebhookDeliverySchema)).optional(),
});

export const DomainWithRelationsSchema = DomainSchema.extend({
  project: z.lazy(() => ProjectSchema).optional(),
});

export const IntegrationWithRelationsSchema = IntegrationSchema.extend({
  project: z
    .lazy(() => ProjectSchema)
    .nullable()
    .optional(),
});

export type ProjectWithRelations = z.infer<typeof ProjectWithRelationsSchema>;
export type EnvironmentWithRelations = z.infer<typeof EnvironmentWithRelationsSchema>;
export type DeploymentWithRelations = z.infer<typeof DeploymentWithRelationsSchema>;
export type ContainerWithRelations = z.infer<typeof ContainerWithRelationsSchema>;
export type ServiceWithRelations = z.infer<typeof ServiceWithRelationsSchema>;
export type ImageWithRelations = z.infer<typeof ImageWithRelationsSchema>;
export type RegistryWithRelations = z.infer<typeof RegistryWithRelationsSchema>;
export type AlertRuleWithRelations = z.infer<typeof AlertRuleWithRelationsSchema>;
export type AlertChannelWithRelations = z.infer<typeof AlertChannelWithRelationsSchema>;
export type JobWithRelations = z.infer<typeof JobWithRelationsSchema>;
export type TeamWithRelations = z.infer<typeof TeamWithRelationsSchema>;
export type TeamMemberWithRelations = z.infer<typeof TeamMemberWithRelationsSchema>;
export type WebhookWithRelations = z.infer<typeof WebhookWithRelationsSchema>;
export type DomainWithRelations = z.infer<typeof DomainWithRelationsSchema>;
export type IntegrationWithRelations = z.infer<typeof IntegrationWithRelationsSchema>;
