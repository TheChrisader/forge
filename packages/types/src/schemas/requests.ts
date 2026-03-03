import { z } from "zod";
import {
  IdSchema,
  NonEmptyStringSchema,
  MetadataSchema,
  ConfigSchema,
  JsonSchema,
  ProjectStatusSchema,
  ProjectSourceTypeSchema,
  DeploymentStatusSchema,
  DeploymentStrategySchema,
  ActiveEnvironmentSchema,
  PortProtocolSchema,
  VolumeModeSchema,
  SourceTypeSchema,
  GitProviderSchema,
  WebhookEventSchema,
  TeamRoleSchema,
  ServiceTypeSchema,
  BackupTypeSchema,
  RegistryTypeSchema,
  AlertOperatorSchema,
  AlertSeveritySchema,
  AlertStatusSchema,
  ChannelTypeSchema,
  IntegrationTypeSchema,
  PolicyActionSchema,
  TracingBackendSchema,
} from "./common";

import { ProjectConfigSchema } from "./project-config";
// =============================================================================
// COMMON QUERY PARAMS
// =============================================================================

export const DeleteQuerySchema = z
  .object({
    force: z.coerce.boolean().optional(),
  })
  .strict();

export const BatchDeleteQuerySchema = z
  .object({
    ids: z.array(IdSchema).min(1),
    force: z.coerce.boolean().optional(),
  })
  .strict();

export const FilteredDeleteQuerySchema = z
  .object({
    projectId: IdSchema.optional(),
    userId: IdSchema.optional(),
    before: z.coerce.date().optional(),
    after: z.coerce.date().optional(),
    force: z.coerce.boolean().optional(),
  })
  .strict();

// =============================================================================
// USER & TEAM MANAGEMENT
// =============================================================================

export const CreateUserRequestSchema = z
  .object({
    email: NonEmptyStringSchema.max(255),
    name: z.string().max(255).nullable().optional(),
    avatarUrl: z.string().max(500).nullable().optional(),
  })
  .strict();

export const UpdateUserRequestSchema = z
  .object({
    email: NonEmptyStringSchema.max(255).optional(),
    name: z.string().max(255).nullable().optional(),
    avatarUrl: z.string().max(500).nullable().optional(),
  })
  .strict();

// -----------------------------------------------------------------------------
// Team
// -----------------------------------------------------------------------------

export const CreateTeamRequestSchema = z
  .object({
    name: NonEmptyStringSchema.max(255),
    slug: NonEmptyStringSchema.max(100),
  })
  .strict();

export const UpdateTeamRequestSchema = z
  .object({
    name: NonEmptyStringSchema.max(255).optional(),
    slug: NonEmptyStringSchema.max(100).optional(),
  })
  .strict();

// -----------------------------------------------------------------------------
// Team Member
// -----------------------------------------------------------------------------

export const CreateTeamMemberRequestSchema = z
  .object({
    teamId: IdSchema,
    userId: IdSchema,
    role: TeamRoleSchema.optional(),
  })
  .strict();

export const UpdateTeamMemberRequestSchema = z
  .object({
    role: TeamRoleSchema.optional(),
  })
  .strict();

// =============================================================================
// RBAC (ROLE-BASED ACCESS CONTROL)
// =============================================================================

export const CreateRoleRequestSchema = z
  .object({
    name: NonEmptyStringSchema.max(100),
    description: z.string().nullable().optional(),
    isSystem: z.boolean().optional(),
  })
  .strict();

export const UpdateRoleRequestSchema = z
  .object({
    name: NonEmptyStringSchema.max(100).optional(),
    description: z.string().nullable().optional(),
    isSystem: z.boolean().optional(),
  })
  .strict();

// -----------------------------------------------------------------------------
// Permission
// -----------------------------------------------------------------------------

export const CreatePermissionRequestSchema = z
  .object({
    resource: NonEmptyStringSchema.max(100),
    action: NonEmptyStringSchema.max(100),
    description: z.string().nullable().optional(),
  })
  .strict();

export const UpdatePermissionRequestSchema = z
  .object({
    resource: NonEmptyStringSchema.max(100).optional(),
    action: NonEmptyStringSchema.max(100).optional(),
    description: z.string().nullable().optional(),
  })
  .strict();

// -----------------------------------------------------------------------------
// Role Permission
// -----------------------------------------------------------------------------

export const CreateRolePermissionRequestSchema = z
  .object({
    roleId: IdSchema,
    permissionId: IdSchema,
  })
  .strict();

// -----------------------------------------------------------------------------
// Role Assignment
// -----------------------------------------------------------------------------

export const CreateRoleAssignmentRequestSchema = z
  .object({
    userId: IdSchema,
    roleId: IdSchema,
    resourceType: z.string().max(100).nullable().optional(),
    resourceId: IdSchema.nullable().optional(),
  })
  .strict();

// =============================================================================
// PROJECTS & ENVIRONMENTS
// =============================================================================

export const CreateProjectRequestSchema = z
  .object({
    name: NonEmptyStringSchema.max(255),
    teamId: IdSchema.nullable().optional(),
    type: z.string().max(100).nullable().optional(),
    sourceType: ProjectSourceTypeSchema.nullable().optional(),
    sourceUrl: z.string().nullable().optional(),
    status: ProjectStatusSchema.optional(),
    config: ProjectConfigSchema.optional(),
    metadata: MetadataSchema.optional(),
  })
  .strict();

export const UpdateProjectRequestSchema = z
  .object({
    name: NonEmptyStringSchema.max(255).optional(),
    teamId: IdSchema.nullable().optional(),
    type: z.string().max(100).nullable().optional(),
    sourceType: ProjectSourceTypeSchema.nullable().optional(),
    sourceUrl: z.string().nullable().optional(),
    status: ProjectStatusSchema.optional(),
    config: ProjectConfigSchema.optional(),
    metadata: MetadataSchema.optional(),
  })
  .strict();

// -----------------------------------------------------------------------------
// Environment
// -----------------------------------------------------------------------------

export const CreateEnvironmentRequestSchema = z
  .object({
    projectId: IdSchema,
    name: NonEmptyStringSchema.max(100),
    slug: NonEmptyStringSchema.max(100),
    isProduction: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    autoDeploy: z.boolean().optional(),
    branch: z.string().max(255).nullable().optional(),
    domain: z.string().max(255).nullable().optional(),
    subdomain: z.string().max(255).nullable().optional(),
  })
  .strict();

export const UpdateEnvironmentRequestSchema = z
  .object({
    name: NonEmptyStringSchema.max(100).optional(),
    slug: NonEmptyStringSchema.max(100).optional(),
    isProduction: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    autoDeploy: z.boolean().optional(),
    branch: z.string().max(255).nullable().optional(),
    domain: z.string().max(255).nullable().optional(),
    subdomain: z.string().max(255).nullable().optional(),
  })
  .strict();

// =============================================================================
// DEPLOYMENTS
// =============================================================================

export const CreateDeploymentRequestSchema = z
  .object({
    projectId: IdSchema,
    environmentId: IdSchema.nullable().optional(),
    status: DeploymentStatusSchema.optional(),
    strategy: DeploymentStrategySchema.optional(),
    buildImage: z.string().max(500).nullable().optional(),
    blueEnvironmentId: IdSchema.nullable().optional(),
    greenEnvironmentId: IdSchema.nullable().optional(),
    activeEnvironment: ActiveEnvironmentSchema.nullable().optional(),
    canaryPercentage: z.number().int().nullable().optional(),
    canaryMetrics: JsonSchema.nullable().optional(),
    canRollback: z.boolean().optional(),
    parentId: IdSchema.nullable().optional(),
  })
  .strict();

export const UpdateDeploymentRequestSchema = z
  .object({
    environmentId: IdSchema.nullable().optional(),
    status: DeploymentStatusSchema.optional(),
    strategy: DeploymentStrategySchema.optional(),
    buildImage: z.string().max(500).nullable().optional(),
    blueEnvironmentId: IdSchema.nullable().optional(),
    greenEnvironmentId: IdSchema.nullable().optional(),
    activeEnvironment: ActiveEnvironmentSchema.nullable().optional(),
    canaryPercentage: z.number().int().nullable().optional(),
    canaryMetrics: JsonSchema.nullable().optional(),
    canRollback: z.boolean().optional(),
    rollbackReason: z.string().nullable().optional(),
    error: z.string().nullable().optional(),
    parentId: IdSchema.nullable().optional(),
  })
  .strict();

// -----------------------------------------------------------------------------
// Deployment URL
// -----------------------------------------------------------------------------

export const CreateDeploymentUrlRequestSchema = z
  .object({
    deploymentId: IdSchema,
    url: NonEmptyStringSchema.max(500),
    isPreview: z.boolean().optional(),
  })
  .strict();

// -----------------------------------------------------------------------------
// Deployment Comment
// -----------------------------------------------------------------------------

export const CreateDeploymentCommentRequestSchema = z
  .object({
    deploymentId: IdSchema,
    userId: IdSchema,
    content: NonEmptyStringSchema,
  })
  .strict();

export const UpdateDeploymentCommentRequestSchema = z
  .object({
    content: NonEmptyStringSchema.optional(),
  })
  .strict();

// =============================================================================
// CONTAINERS
// =============================================================================

export const CreateContainerRequestSchema = z
  .object({
    projectId: IdSchema,
    deploymentId: IdSchema,
    name: z.string().max(255).nullable().optional(),
    containerId: NonEmptyStringSchema.max(100),
    image: NonEmptyStringSchema.max(500),
    config: ConfigSchema.optional(),
    env: JsonSchema.nullable().optional(),
  })
  .strict();

export const UpdateContainerRequestSchema = z
  .object({
    name: z.string().max(255).nullable().optional(),
    config: ConfigSchema.optional(),
    env: JsonSchema.nullable().optional(),
  })
  .strict();

// -----------------------------------------------------------------------------
// Port Mapping
// -----------------------------------------------------------------------------

export const CreatePortMappingRequestSchema = z
  .object({
    containerId: IdSchema,
    containerPort: z.number().int().positive(),
    hostPort: z.number().int().positive().nullable().optional(),
    protocol: PortProtocolSchema.optional(),
  })
  .strict();

// -----------------------------------------------------------------------------
// Volume Mapping
// -----------------------------------------------------------------------------

export const CreateVolumeMappingRequestSchema = z
  .object({
    containerId: IdSchema,
    source: NonEmptyStringSchema.max(500),
    target: NonEmptyStringSchema.max(500),
    mode: VolumeModeSchema.optional(),
  })
  .strict();

// -----------------------------------------------------------------------------
// Health Check Config
// -----------------------------------------------------------------------------

export const CreateHealthCheckConfigRequestSchema = z
  .object({
    containerId: IdSchema,
    test: NonEmptyStringSchema.max(500),
    interval: z.number().int().positive().optional(),
    timeout: z.number().int().positive().optional(),
    retries: z.number().int().nonnegative().optional(),
    startPeriod: z.number().int().nonnegative().optional(),
  })
  .strict();

export const UpdateHealthCheckConfigRequestSchema = z
  .object({
    test: NonEmptyStringSchema.max(500).optional(),
    interval: z.number().int().positive().optional(),
    timeout: z.number().int().positive().optional(),
    retries: z.number().int().nonnegative().optional(),
    startPeriod: z.number().int().nonnegative().optional(),
  })
  .strict();

// -----------------------------------------------------------------------------
// Network Attachment
// -----------------------------------------------------------------------------

export const CreateNetworkAttachmentRequestSchema = z
  .object({
    containerId: IdSchema,
    networkName: NonEmptyStringSchema.max(255),
  })
  .strict();

export const UpdateNetworkAttachmentRequestSchema = z
  .object({
    networkName: NonEmptyStringSchema.max(255).optional(),
  })
  .strict();

// -----------------------------------------------------------------------------
// Resource Limit
// -----------------------------------------------------------------------------

export const CreateResourceLimitRequestSchema = z
  .object({
    containerId: IdSchema,
    cpuRequest: z.number().nullable().optional(),
    memoryRequest: z.bigint().nullable().optional(),
    cpuLimit: z.number().nullable().optional(),
    memoryLimit: z.bigint().nullable().optional(),
    storageLimit: z.bigint().nullable().optional(),
    bandwidthLimit: z.bigint().nullable().optional(),
  })
  .strict();

export const UpdateResourceLimitRequestSchema = z
  .object({
    cpuRequest: z.number().nullable().optional(),
    memoryRequest: z.bigint().nullable().optional(),
    cpuLimit: z.number().nullable().optional(),
    memoryLimit: z.bigint().nullable().optional(),
    storageLimit: z.bigint().nullable().optional(),
    bandwidthLimit: z.bigint().nullable().optional(),
  })
  .strict();

// =============================================================================
// CONTAINER REGISTRY & IMAGES
// =============================================================================

export const CreateRegistryRequestSchema = z
  .object({
    name: NonEmptyStringSchema.max(255),
    type: RegistryTypeSchema,
    url: NonEmptyStringSchema.max(500),
    username: z.string().max(255).nullable().optional(),
    password: z.string().max(500).nullable().optional(),
    token: z.string().max(500).nullable().optional(),
    isDefault: z.boolean().optional(),
    isPublic: z.boolean().optional(),
    scanOnPush: z.boolean().optional(),
  })
  .strict();

export const UpdateRegistryRequestSchema = z
  .object({
    name: NonEmptyStringSchema.max(255).optional(),
    url: NonEmptyStringSchema.max(500).optional(),
    username: z.string().max(255).nullable().optional(),
    password: z.string().max(500).nullable().optional(),
    token: z.string().max(500).nullable().optional(),
    isDefault: z.boolean().optional(),
    isPublic: z.boolean().optional(),
    scanOnPush: z.boolean().optional(),
  })
  .strict();

// -----------------------------------------------------------------------------
// Image
// -----------------------------------------------------------------------------

export const CreateImageRequestSchema = z
  .object({
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
  })
  .strict();

export const UpdateImageRequestSchema = z
  .object({
    repository: NonEmptyStringSchema.max(500).optional(),
    tag: NonEmptyStringSchema.max(255).optional(),
  })
  .strict();

// =============================================================================
// SERVICES (DATABASE, CACHE, QUEUE, etc.)
// =============================================================================

export const CreateServiceRequestSchema = z
  .object({
    projectId: IdSchema,
    name: NonEmptyStringSchema.max(255),
    type: ServiceTypeSchema,
    config: ConfigSchema.optional(),
  })
  .strict();

// Services are managed by the platform - no client updates

// -----------------------------------------------------------------------------
// Service Backup
// -----------------------------------------------------------------------------

export const CreateServiceBackupRequestSchema = z
  .object({
    serviceId: IdSchema,
    type: BackupTypeSchema,
    path: NonEmptyStringSchema.max(500),
  })
  .strict();

export const UpdateServiceBackupRequestSchema = z
  .object({
    path: NonEmptyStringSchema.max(500).optional(),
  })
  .strict();

// =============================================================================
// SECRETS & ENVIRONMENT VARIABLES
// =============================================================================

export const CreateSecretRequestSchema = z
  .object({
    projectId: IdSchema.nullable().optional(),
    key: NonEmptyStringSchema.max(255),
    value: z.string(),
    description: z.string().nullable().optional(),
  })
  .strict();

export const UpdateSecretRequestSchema = z
  .object({
    key: NonEmptyStringSchema.max(255).optional(),
    value: z.string().optional(),
    description: z.string().nullable().optional(),
  })
  .strict();

// -----------------------------------------------------------------------------
// Environment Variable
// -----------------------------------------------------------------------------

export const CreateEnvironmentVariableRequestSchema = z
  .object({
    projectId: IdSchema,
    environmentId: IdSchema.nullable().optional(),
    key: NonEmptyStringSchema.max(255),
    value: NonEmptyStringSchema,
  })
  .strict();

export const UpdateEnvironmentVariableRequestSchema = z
  .object({
    environmentId: IdSchema.nullable().optional(),
    key: NonEmptyStringSchema.max(255).optional(),
    value: NonEmptyStringSchema.optional(),
  })
  .strict();

// =============================================================================
// OBSERVABILITY (LOGS, METRICS, TRACING)
// =============================================================================

// Logs and metrics are generated by the system - no client request schemas

// -----------------------------------------------------------------------------
// Tracing Config
// -----------------------------------------------------------------------------

export const CreateTracingConfigRequestSchema = z
  .object({
    projectId: IdSchema,
    enabled: z.boolean().optional(),
    backend: TracingBackendSchema,
    endpoint: NonEmptyStringSchema.max(500),
    sampleRate: z.number().optional(),
    captureHeaders: z.array(z.string()).optional(),
    autoInstrument: z.boolean().optional(),
  })
  .strict();

export const UpdateTracingConfigRequestSchema = z
  .object({
    enabled: z.boolean().optional(),
    backend: TracingBackendSchema.optional(),
    endpoint: NonEmptyStringSchema.max(500).optional(),
    sampleRate: z.number().optional(),
    captureHeaders: z.array(z.string()).optional(),
    autoInstrument: z.boolean().optional(),
  })
  .strict();

// =============================================================================
// ALERTING
// =============================================================================

export const CreateAlertRuleRequestSchema = z
  .object({
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
  })
  .strict();

export const UpdateAlertRuleRequestSchema = z
  .object({
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
  })
  .strict();

// -----------------------------------------------------------------------------
// Alert
// -----------------------------------------------------------------------------

export const CreateAlertRequestSchema = z
  .object({
    ruleId: IdSchema,
    severity: AlertSeveritySchema,
    value: z.number(),
    message: NonEmptyStringSchema,
  })
  .strict();

export const UpdateAlertRequestSchema = z
  .object({
    status: AlertStatusSchema.optional(),
    severity: AlertSeveritySchema.optional(),
    value: z.number().optional(),
    message: NonEmptyStringSchema.optional(),
  })
  .strict();

// -----------------------------------------------------------------------------
// Alert Channel
// -----------------------------------------------------------------------------

export const CreateAlertChannelRequestSchema = z
  .object({
    projectId: IdSchema.nullable().optional(),
    name: NonEmptyStringSchema.max(255),
    type: ChannelTypeSchema,
    config: ConfigSchema,
    enabled: z.boolean().optional(),
  })
  .strict();

export const UpdateAlertChannelRequestSchema = z
  .object({
    name: NonEmptyStringSchema.max(255).optional(),
    type: ChannelTypeSchema.optional(),
    config: ConfigSchema.optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

// -----------------------------------------------------------------------------
// Alert Channel Rule
// -----------------------------------------------------------------------------

export const CreateAlertChannelRuleRequestSchema = z
  .object({
    ruleId: IdSchema,
    channelId: IdSchema,
    severities: z.array(AlertSeveritySchema),
  })
  .strict();

export const UpdateAlertChannelRuleRequestSchema = z
  .object({
    severities: z.array(AlertSeveritySchema).optional(),
  })
  .strict();

// Alert notifications are generated by the system - no client request schemas

// =============================================================================
// JOBS & AUTOMATION
// =============================================================================

export const CreateJobRequestSchema = z
  .object({
    projectId: IdSchema,
    name: NonEmptyStringSchema.max(255),
    description: z.string().nullable().optional(),
    command: NonEmptyStringSchema,
    schedule: z.string().max(100).nullable().optional(),
    enabled: z.boolean().optional(),
    timeout: z.number().int().nonnegative().optional(),
    retries: z.number().int().nonnegative().optional(),
    retryDelay: z.number().int().nonnegative().optional(),
    env: JsonSchema.nullable().optional(),
  })
  .strict();

export const UpdateJobRequestSchema = z
  .object({
    name: NonEmptyStringSchema.max(255).optional(),
    description: z.string().nullable().optional(),
    command: NonEmptyStringSchema.optional(),
    schedule: z.string().max(100).nullable().optional(),
    enabled: z.boolean().optional(),
    timeout: z.number().int().nonnegative().optional(),
    retries: z.number().int().nonnegative().optional(),
    retryDelay: z.number().int().nonnegative().optional(),
    env: JsonSchema.nullable().optional(),
  })
  .strict();

// -----------------------------------------------------------------------------
// Job Run
// -----------------------------------------------------------------------------

export const CreateJobRunRequestSchema = z
  .object({
    jobId: IdSchema,
  })
  .strict();

// Job runs are immutable execution records - no update schema

// =============================================================================
// DOMAINS & NETWORKING
// =============================================================================

export const CreateDomainRequestSchema = z
  .object({
    projectId: IdSchema,
    domain: NonEmptyStringSchema.max(255),
    isPrimary: z.boolean().optional(),
  })
  .strict();

export const UpdateDomainRequestSchema = z
  .object({
    domain: NonEmptyStringSchema.max(255).optional(),
    isPrimary: z.boolean().optional(),
  })
  .strict();

// -----------------------------------------------------------------------------
// Network Policy
// -----------------------------------------------------------------------------

export const CreateNetworkPolicyRequestSchema = z
  .object({
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
  })
  .strict();

export const UpdateNetworkPolicyRequestSchema = z
  .object({
    name: NonEmptyStringSchema.max(255).optional(),
    description: z.string().nullable().optional(),
    sourceSelector: ConfigSchema.optional(),
    targetSelector: ConfigSchema.optional(),
    action: PolicyActionSchema.optional(),
    protocol: z.string().max(50).nullable().optional(),
    ports: z.array(z.number().int()).optional(),
    enabled: z.boolean().optional(),
    priority: z.number().int().optional(),
  })
  .strict();

// =============================================================================
// GIT INTEGRATION
// =============================================================================

export const CreateGitIntegrationRequestSchema = z
  .object({
    projectId: IdSchema,
    provider: GitProviderSchema,
    repository: NonEmptyStringSchema.max(255),
    branch: NonEmptyStringSchema.max(255).optional(),
    autoDeploy: z.boolean().optional(),
  })
  .strict();

export const UpdateGitIntegrationRequestSchema = z
  .object({
    provider: GitProviderSchema.optional(),
    repository: NonEmptyStringSchema.max(255).optional(),
    branch: NonEmptyStringSchema.max(255).optional(),
    autoDeploy: z.boolean().optional(),
  })
  .strict();

// Git commits are linked to deployments - no client request schemas

// =============================================================================
// WEBHOOKS
// =============================================================================

export const CreateWebhookRequestSchema = z
  .object({
    projectId: IdSchema,
    url: NonEmptyStringSchema.max(500),
    secret: NonEmptyStringSchema.max(255),
    events: z.array(WebhookEventSchema),
    enabled: z.boolean().optional(),
  })
  .strict();

export const UpdateWebhookRequestSchema = z
  .object({
    url: NonEmptyStringSchema.max(500).optional(),
    secret: NonEmptyStringSchema.max(255).optional(),
    events: z.array(WebhookEventSchema).optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

// Webhook deliveries are generated by the system - no client request schemas

// =============================================================================
// INTEGRATIONS
// =============================================================================

export const CreateIntegrationRequestSchema = z
  .object({
    projectId: IdSchema.nullable().optional(),
    type: IntegrationTypeSchema,
    name: NonEmptyStringSchema.max(255),
    config: ConfigSchema,
    enabled: z.boolean().optional(),
  })
  .strict();

export const UpdateIntegrationRequestSchema = z
  .object({
    type: IntegrationTypeSchema.optional(),
    name: NonEmptyStringSchema.max(255).optional(),
    config: ConfigSchema.optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

// =============================================================================
// API KEYS
// =============================================================================

export const CreateApiKeyRequestSchema = z
  .object({
    userId: IdSchema.nullable().optional(),
    projectId: IdSchema.nullable().optional(),
    name: NonEmptyStringSchema.max(255),
    scopes: z.array(z.string()).optional(),
  })
  .strict();

// API keys are immutable for security - delete and recreate to modify

// Build cache and audit logs are system-managed - no client request schemas
