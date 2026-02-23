import { z } from "zod";

// =============================================================================
// Base Schemas
// =============================================================================

export const IdSchema = z.uuid();
// export const TimestampSchema = z.iso.datetime({ offset: true });
export const TimestampSchema = z.coerce.date();
export const NonEmptyStringSchema = z.string().min(1);
export const MetadataSchema = z.record(z.string(), z.unknown());
export const ConfigSchema = z.record(z.string(), z.unknown());
export const JsonSchema = z.record(z.string(), z.unknown());

// =============================================================================
// Enum Schemas - matching Prisma schema exactly
// =============================================================================

// Project & Deployment
export const ProjectStatusSchema = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);
export const DeploymentStatusSchema = z.enum([
  "PENDING",
  "QUEUED",
  "BUILDING",
  "DEPLOYING",
  "ROLLBACK",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "TIMED_OUT",
]);
export const DeploymentStrategySchema = z.enum(["ROLLING", "BLUE_GREEN", "CANARY", "RECREATE"]);
export const ActiveEnvironmentSchema = z.enum(["BLUE", "GREEN"]);

// Container & Health
export const ContainerStatusSchema = z.enum([
  "CREATING",
  "STARTING",
  "RUNNING",
  "HEALTHY",
  "UNHEALTHY",
  "STOPPING",
  "STOPPED",
  "RESTARTING",
  "TERMINATED",
  "ERROR",
]);
export const HealthStatusSchema = z.enum(["HEALTHY", "UNHEALTHY", "STARTING"]);

// Networking
export const PortProtocolSchema = z.enum(["TCP", "UDP"]);
export const VolumeModeSchema = z.enum(["RW", "RO"]);

// Observability
export const LogLevelSchema = z.enum(["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"]);
export const SourceTypeSchema = z.enum(["CONTAINER", "SERVICE", "SYSTEM", "BUILD", "DEPLOYMENT"]);
export const TracingBackendSchema = z.enum([
  "JAEGER",
  "ZIPKIN",
  "TEMPO",
  "LIGHTSTEP",
  "HONEYCOMB",
  "DATADOG",
]);

// Services
export const ServiceTypeSchema = z.enum([
  "DATABASE",
  "CACHE",
  "QUEUE",
  "STORAGE",
  "SEARCH",
  "MONITORING",
  "CUSTOM",
]);
export const ServiceStatusSchema = z.enum([
  "CREATING",
  "STARTING",
  "RUNNING",
  "HEALTHY",
  "UNHEALTHY",
  "STOPPING",
  "STOPPED",
  "ERROR",
  "UPGRADING",
  "BACKING_UP",
  "RESTORING",
]);
export const BackupTypeSchema = z.enum(["MANUAL", "SCHEDULED", "PRE_UPGRADE"]);
export const BackupStatusSchema = z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED"]);

// Registry & Security
export const RegistryTypeSchema = z.enum([
  "DOCKER_HUB",
  "GHCR",
  "ECR",
  "GCR",
  "ACR",
  "HARBOR",
  "QUAY",
  "SELF_HOSTED",
]);
export const ScanStatusSchema = z.enum(["PENDING", "SCANNING", "COMPLETED", "FAILED"]);
export const SeveritySchema = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "NEGLIGIBLE"]);
export const SslStatusSchema = z.enum(["PENDING", "ACTIVE", "EXPIRED", "FAILED"]);

// Jobs
export const JobStatusSchema = z.enum(["IDLE", "RUNNING"]);
export const JobRunStatusSchema = z.enum(["RUNNING", "SUCCESS", "FAILED", "TIMEOUT", "CANCELLED"]);
export const TriggerTypeSchema = z.enum(["SCHEDULED", "MANUAL", "WEBHOOK", "DEPLOYMENT"]);

// Alerting
export const AlertOperatorSchema = z.enum(["GREATER_THAN", "LESS_THAN", "EQUALS", "NOT_EQUALS"]);
export const AlertSeveritySchema = z.enum(["INFO", "WARNING", "CRITICAL"]);
export const AlertStatusSchema = z.enum(["FIRING", "RESOLVED", "ACKNOWLEDGED"]);
export const ChannelTypeSchema = z.enum([
  "EMAIL",
  "SLACK",
  "PAGERDUTY",
  "WEBHOOK",
  "SMS",
  "DISCORD",
  "TEAMS",
]);
export const NotificationStatusSchema = z.enum(["PENDING", "SENT", "FAILED"]);

// Integrations
export const IntegrationTypeSchema = z.enum([
  "AWS_S3",
  "GCS",
  "AZURE_BLOB",
  "CLOUDFLARE_R2",
  "BACKBLAZE_B2",
  "DATADOG",
  "NEW_RELIC",
  "SENTRY",
  "SLACK",
  "DISCORD",
  "PAGERDUTY",
  "GITHUB_ACTIONS",
  "GITLAB_CI",
  "CIRCLE_CI",
  "SENDGRID",
  "MAILGUN",
  "SES",
  "CLOUDFLARE_DNS",
  "ROUTE53",
  "CUSTOM",
]);

// Git
export const GitProviderSchema = z.enum(["GITHUB", "GITLAB", "BITBUCKET"]);
export const WebhookEventSchema = z.enum([
  "DEPLOYMENT_CREATED",
  "DEPLOYMENT_BUILDING",
  "DEPLOYMENT_READY",
  "DEPLOYMENT_ERROR",
  "DEPLOYMENT_CANCELLED",
  "DOMAIN_VERIFIED",
  "DOMAIN_FAILED",
]);

// RBAC
export const TeamRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]);
export const PolicyActionSchema = z.enum(["ALLOW", "DENY"]);

// Utility
export const SortOrderSchema = z.enum(["asc", "desc"]);

export const PaginationParamsSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export const SortParamsSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: SortOrderSchema.optional(),
});
