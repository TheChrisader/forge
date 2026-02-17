import { z } from "zod";
import {
  IdSchema,
  JobEntityStatusSchema,
  LogLevelSchema,
  MetadataSchema,
  NonEmptyStringSchema,
  ServiceStatusSchema,
  ServiceTypeSchema,
  SourceTypeSchema,
  TimestampSchema,
} from "./common";

// =============================================================================
// Project Schemas
// =============================================================================

export const ProjectStatusSchema = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);

export const ProjectSchema = z.object({
  id: IdSchema,
  name: NonEmptyStringSchema.max(255),
  type: z.string().max(50).nullable(),
  sourceType: z.string().max(50).nullable(),
  sourceUrl: z.string().nullable(),
  status: ProjectStatusSchema,
  config: MetadataSchema,
  metadata: MetadataSchema,
  deletedAt: TimestampSchema.optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
});

export const CreateProjectSchema = z.object({
  name: NonEmptyStringSchema.max(255),
  type: z.string().max(50).optional(),
  sourceType: z.string().max(50).optional(),
  sourceUrl: z.string().optional(),
  status: ProjectStatusSchema.optional(),
  config: MetadataSchema.optional(),
  metadata: MetadataSchema.optional(),
  createdBy: z.string().optional(),
});

export const UpdateProjectSchema = z.object({
  name: NonEmptyStringSchema.max(255).optional(),
  type: z.string().max(50).optional(),
  sourceType: z.string().max(50).optional(),
  sourceUrl: z.string().optional(),
  status: ProjectStatusSchema.optional(),
  config: MetadataSchema.optional(),
  metadata: MetadataSchema.optional(),
  updatedBy: z.string().optional(),
});

// =============================================================================
// Deployment Schemas
// =============================================================================

export const DeploymentStatusSchema = z.enum([
  "PENDING",
  "BUILDING",
  "DEPLOYING",
  "RUNNING",
  "FAILED",
  "ROLLED_BACK",
]);

export const DeploymentSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  version: NonEmptyStringSchema,
  status: DeploymentStatusSchema,
  buildStartedAt: TimestampSchema.optional(),
  buildCompletedAt: TimestampSchema.optional(),
  buildImage: z.string().optional(),
  buildLogs: z.string().optional(),
  deployStartedAt: TimestampSchema.optional(),
  deployCompletedAt: TimestampSchema.optional(),
  error: z.string().optional(),
  parentId: IdSchema.optional(),
  createdAt: TimestampSchema,
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
});

export const CreateDeploymentSchema = z.object({
  projectId: IdSchema,
  version: NonEmptyStringSchema,
  status: DeploymentStatusSchema.optional(),
  buildStartedAt: TimestampSchema.optional(),
  buildCompletedAt: TimestampSchema.optional(),
  buildImage: z.string().optional(),
  buildLogs: z.string().optional(),
  deployStartedAt: TimestampSchema.optional(),
  deployCompletedAt: TimestampSchema.optional(),
  error: z.string().optional(),
  parentId: IdSchema.optional(),
  createdBy: z.string().optional(),
});

export const UpdateDeploymentSchema = z.object({
  version: NonEmptyStringSchema.optional(),
  status: DeploymentStatusSchema.optional(),
  buildStartedAt: TimestampSchema.optional(),
  buildCompletedAt: TimestampSchema.optional(),
  buildImage: z.string().optional(),
  buildLogs: z.string().optional(),
  deployStartedAt: TimestampSchema.optional(),
  deployCompletedAt: TimestampSchema.optional(),
  error: z.string().optional(),
  parentId: IdSchema.optional(),
  updatedBy: z.string().optional(),
});

// =============================================================================
// Container Schemas
// =============================================================================

export const ContainerStatusSchema = z.enum([
  "CREATING",
  "STARTING",
  "RUNNING",
  "STOPPING",
  "STOPPED",
  "TERMINATED",
  "ERROR",
]);
const HealthStatusSchema = z.enum(["HEALTHY", "UNHEALTHY", "STARTING"]);

export const ContainerSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  deploymentId: IdSchema,
  name: z.string().max(255).optional(),
  containerId: NonEmptyStringSchema,
  image: NonEmptyStringSchema,
  status: ContainerStatusSchema,
  containerNumber: z.int().positive().default(1),
  config: MetadataSchema,
  env: z.record(z.string(), z.unknown()).optional(),
  healthStatus: HealthStatusSchema.optional(),
  healthChecks: z.int().default(0),
  healthFails: z.int().default(0),
  lastHealthCheckAt: TimestampSchema.optional(),
  replacedById: IdSchema.optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  startedAt: TimestampSchema.optional(),
  stoppedAt: TimestampSchema.optional(),
  deletedAt: TimestampSchema.optional(),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
});

export const CreateContainerSchema = z.object({
  projectId: IdSchema,
  deploymentId: IdSchema,
  name: z.string().max(255).optional(),
  containerId: NonEmptyStringSchema,
  image: NonEmptyStringSchema,
  status: ContainerStatusSchema.optional(),
  containerNumber: z.int().positive().optional(),
  config: MetadataSchema.optional(),
  env: z.record(z.string(), z.unknown()).optional(),
  healthStatus: HealthStatusSchema.optional(),
  replacedById: IdSchema.optional(),
  createdBy: z.string().optional(),
});

export const UpdateContainerSchema = z.object({
  name: z.string().max(255).optional(),
  status: ContainerStatusSchema.optional(),
  config: MetadataSchema.optional(),
  env: z.record(z.string(), z.unknown()).optional(),
  healthStatus: HealthStatusSchema.optional(),
  healthChecks: z.int().optional(),
  healthFails: z.int().optional(),
  lastHealthCheckAt: TimestampSchema.optional(),
  startedAt: TimestampSchema.optional(),
  stoppedAt: TimestampSchema.optional(),
  deletedAt: TimestampSchema.optional(),
  updatedBy: z.string().optional(),
});

// =============================================================================
// Port Mapping Schemas
// =============================================================================

export const PortProtocolSchema = z.enum(["TCP", "UDP"]);

export const PortMappingSchema = z.object({
  id: IdSchema,
  containerId: IdSchema,
  containerPort: z.int().positive(),
  hostPort: z.int().positive().optional(),
  protocol: PortProtocolSchema.default("TCP"),
});

export const CreatePortMappingSchema = z.object({
  containerId: IdSchema,
  containerPort: z.int().positive(),
  hostPort: z.int().positive().optional(),
  protocol: PortProtocolSchema.optional(),
});

// =============================================================================
// Volume Mapping Schemas
// =============================================================================

export const VolumeModeSchema = z.enum(["RW", "RO"]);

export const VolumeMappingSchema = z.object({
  id: IdSchema,
  containerId: IdSchema,
  source: NonEmptyStringSchema,
  target: NonEmptyStringSchema,
  mode: VolumeModeSchema.default("RW"),
});

export const CreateVolumeMappingSchema = z.object({
  containerId: IdSchema,
  source: NonEmptyStringSchema,
  target: NonEmptyStringSchema,
  mode: VolumeModeSchema.optional(),
});

// =============================================================================
// Health Check Config Schemas
// =============================================================================

export const HealthCheckConfigSchema = z.object({
  id: IdSchema,
  containerId: IdSchema,
  test: NonEmptyStringSchema,
  interval: z.int().positive().default(30),
  timeout: z.int().positive().default(5),
  retries: z.int().nonnegative().default(3),
  startPeriod: z.int().nonnegative().default(0),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const CreateHealthCheckConfigSchema = z.object({
  containerId: IdSchema,
  test: NonEmptyStringSchema,
  interval: z.int().positive().optional(),
  timeout: z.int().positive().optional(),
  retries: z.int().nonnegative().optional(),
  startPeriod: z.int().nonnegative().optional(),
});

// =============================================================================
// Network Attachment Schemas
// =============================================================================

export const NetworkAttachmentSchema = z.object({
  id: IdSchema,
  containerId: IdSchema,
  networkName: NonEmptyStringSchema,
  ipAddress: z.string().optional(),
  macAddress: z.string().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const CreateNetworkAttachmentSchema = z.object({
  containerId: IdSchema,
  networkName: NonEmptyStringSchema,
  ipAddress: z.string().optional(),
  macAddress: z.string().optional(),
});

// =============================================================================
// Service Schemas
// =============================================================================

export const ServiceConnectionSchema = z.object({
  host: z.string(),
  port: z.int().positive(),
  url: z.string().optional(),
  username: z.string().optional(),
  database: z.string().optional(),
});

export const ServiceSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  name: NonEmptyStringSchema.max(100),
  type: ServiceTypeSchema,
  engine: z.string().optional(),
  version: z.string().optional(),
  status: ServiceStatusSchema,
  config: MetadataSchema,
  connection: ServiceConnectionSchema.optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

// =============================================================================
// Secret Schemas
// =============================================================================

export const SecretSchema = z.object({
  id: IdSchema,
  projectId: IdSchema.optional(),
  key: NonEmptyStringSchema.max(100),
  description: z.string().max(500).optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  createdBy: z.string().optional(),
});

// =============================================================================
// Logging Schemas
// =============================================================================

export const LogEntrySchema = z.object({
  id: IdSchema,
  timestamp: TimestampSchema,
  level: LogLevelSchema,
  sourceType: SourceTypeSchema,
  sourceId: z.string(),
  sourceName: z.string(),
  message: z.string(),
  context: z.record(z.string(), z.unknown()).optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
});

// =============================================================================
// Metrics Schemas
// =============================================================================

export const MetricSchema = z.object({
  id: IdSchema,
  timestamp: TimestampSchema,
  sourceType: SourceTypeSchema,
  sourceId: z.string(),
  sourceName: z.string(),
  metric: z.string(),
  value: z.number(),
  unit: z.string().optional(),
  labels: z.record(z.string(), z.string()).optional(),
});

// =============================================================================
// Job Schemas
// =============================================================================

export const JobSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  name: NonEmptyStringSchema.max(100),
  command: z.string(),
  schedule: z.string().optional(),
  status: JobEntityStatusSchema,
  lastRun: TimestampSchema.optional(),
  nextRun: TimestampSchema.optional(),
  enabled: z.boolean(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

// =============================================================================
// With Relations Schemas
// =============================================================================

export const ProjectWithRelationsSchema = ProjectSchema.extend({
  deployments: z.array(z.lazy(() => DeploymentSchema)).optional(),
  containers: z.array(z.lazy(() => ContainerSchema)).optional(),
});

export const DeploymentWithRelationsSchema = DeploymentSchema.extend({
  project: z.lazy(() => ProjectSchema.optional()),
  containers: z.array(z.lazy(() => ContainerSchema)).optional(),
  parent: z.lazy(() => DeploymentSchema).optional(),
  children: z.array(z.lazy(() => DeploymentSchema)).optional(),
});

export const ContainerWithRelationsSchema = ContainerSchema.extend({
  project: z.lazy(() => ProjectSchema.optional()),
  deployment: z.lazy(() => DeploymentSchema.optional()),
  ports: z.array(PortMappingSchema).optional(),
  volumes: z.array(VolumeMappingSchema).optional(),
  healthCheckConfig: HealthCheckConfigSchema.optional(),
  networkAttachments: z.array(NetworkAttachmentSchema).optional(),
  replacedBy: z.lazy(() => ContainerSchema).optional(),
  replaces: z.array(z.lazy(() => ContainerSchema)).optional(),
});

// =============================================================================
// Inferred WithRelations Types
// =============================================================================

export type ProjectWithRelations = z.infer<typeof ProjectWithRelationsSchema>;
export type DeploymentWithRelations = z.infer<typeof DeploymentWithRelationsSchema>;
export type ContainerWithRelations = z.infer<typeof ContainerWithRelationsSchema>;
