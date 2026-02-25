-- CreateEnum
CREATE TYPE "project_status" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "deployment_status" AS ENUM ('PENDING', 'QUEUED', 'BUILDING', 'DEPLOYING', 'ROLLBACK', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT');

-- CreateEnum
CREATE TYPE "deployment_strategy" AS ENUM ('ROLLING', 'BLUE_GREEN', 'CANARY', 'RECREATE');

-- CreateEnum
CREATE TYPE "active_environment" AS ENUM ('BLUE', 'GREEN');

-- CreateEnum
CREATE TYPE "container_status" AS ENUM ('CREATING', 'STARTING', 'RUNNING', 'HEALTHY', 'UNHEALTHY', 'STOPPING', 'STOPPED', 'RESTARTING', 'TERMINATED', 'ERROR');

-- CreateEnum
CREATE TYPE "health_status" AS ENUM ('HEALTHY', 'UNHEALTHY', 'STARTING');

-- CreateEnum
CREATE TYPE "port_protocol" AS ENUM ('TCP', 'UDP');

-- CreateEnum
CREATE TYPE "volume_mode" AS ENUM ('RW', 'RO');

-- CreateEnum
CREATE TYPE "log_level" AS ENUM ('TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL');

-- CreateEnum
CREATE TYPE "build_log_source" AS ENUM ('BUILD', 'SYSTEM', 'USER', 'DEPLOY');

-- CreateEnum
CREATE TYPE "source_type" AS ENUM ('CONTAINER', 'SERVICE', 'SYSTEM', 'BUILD', 'DEPLOYMENT');

-- CreateEnum
CREATE TYPE "ssl_status" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "git_provider" AS ENUM ('GITHUB', 'GITLAB', 'BITBUCKET');

-- CreateEnum
CREATE TYPE "webhook_event" AS ENUM ('DEPLOYMENT_CREATED', 'DEPLOYMENT_BUILDING', 'DEPLOYMENT_READY', 'DEPLOYMENT_ERROR', 'DEPLOYMENT_CANCELLED', 'DOMAIN_VERIFIED', 'DOMAIN_FAILED');

-- CreateEnum
CREATE TYPE "team_role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "service_type" AS ENUM ('DATABASE', 'CACHE', 'QUEUE', 'STORAGE', 'SEARCH', 'MONITORING', 'CUSTOM');

-- CreateEnum
CREATE TYPE "service_status" AS ENUM ('CREATING', 'STARTING', 'RUNNING', 'HEALTHY', 'UNHEALTHY', 'STOPPING', 'STOPPED', 'ERROR', 'UPGRADING', 'BACKING_UP', 'RESTORING');

-- CreateEnum
CREATE TYPE "backup_type" AS ENUM ('MANUAL', 'SCHEDULED', 'PRE_UPGRADE');

-- CreateEnum
CREATE TYPE "backup_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "registry_type" AS ENUM ('DOCKER_HUB', 'GHCR', 'ECR', 'GCR', 'ACR', 'HARBOR', 'QUAY', 'SELF_HOSTED');

-- CreateEnum
CREATE TYPE "scan_status" AS ENUM ('PENDING', 'SCANNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NEGLIGIBLE');

-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('IDLE', 'RUNNING');

-- CreateEnum
CREATE TYPE "job_run_status" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'TIMEOUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "trigger_type" AS ENUM ('SCHEDULED', 'MANUAL', 'WEBHOOK', 'DEPLOYMENT');

-- CreateEnum
CREATE TYPE "alert_operator" AS ENUM ('GREATER_THAN', 'LESS_THAN', 'EQUALS', 'NOT_EQUALS');

-- CreateEnum
CREATE TYPE "alert_severity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "alert_status" AS ENUM ('FIRING', 'RESOLVED', 'ACKNOWLEDGED');

-- CreateEnum
CREATE TYPE "channel_type" AS ENUM ('EMAIL', 'SLACK', 'PAGERDUTY', 'WEBHOOK', 'SMS', 'DISCORD', 'TEAMS');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "integration_type" AS ENUM ('AWS_S3', 'GCS', 'AZURE_BLOB', 'CLOUDFLARE_R2', 'BACKBLAZE_B2', 'DATADOG', 'NEW_RELIC', 'SENTRY', 'SLACK', 'DISCORD', 'PAGERDUTY', 'GITHUB_ACTIONS', 'GITLAB_CI', 'CIRCLE_CI', 'SENDGRID', 'MAILGUN', 'SES', 'CLOUDFLARE_DNS', 'ROUTE53', 'CUSTOM');

-- CreateEnum
CREATE TYPE "policy_action" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "tracing_backend" AS ENUM ('JAEGER', 'ZIPKIN', 'TEMPO', 'LIGHTSTEP', 'HONEYCOMB', 'DATADOG');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "avatar_url" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "team_role" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "resource" VARCHAR(100) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_assignments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "resource_type" VARCHAR(100),
    "resource_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "team_id" UUID,
    "type" VARCHAR(100),
    "source_type" VARCHAR(100),
    "source_url" TEXT,
    "status" "project_status" NOT NULL DEFAULT 'INACTIVE',
    "config" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environments" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "is_production" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "auto_deploy" BOOLEAN NOT NULL DEFAULT false,
    "branch" VARCHAR(255),
    "domain" VARCHAR(255),
    "subdomain" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "environments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registries" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "registry_type" NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "username" VARCHAR(255),
    "password_secret_id" UUID,
    "token_secret_id" UUID,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "scan_on_push" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "registries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "images" (
    "id" UUID NOT NULL,
    "registry_id" UUID NOT NULL,
    "project_id" UUID,
    "repository" VARCHAR(500) NOT NULL,
    "tag" VARCHAR(255) NOT NULL,
    "digest" VARCHAR(100) NOT NULL,
    "full_name" VARCHAR(1000) NOT NULL,
    "size" BIGINT NOT NULL,
    "architecture" VARCHAR(50) NOT NULL,
    "os" VARCHAR(50) NOT NULL,
    "build_id" UUID,
    "scan_status" "scan_status",
    "scan_results" JSONB,
    "pushed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_pulled_at" TIMESTAMPTZ,

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vulnerabilities" (
    "id" UUID NOT NULL,
    "image_id" UUID NOT NULL,
    "cve_id" VARCHAR(50),
    "severity" "severity" NOT NULL,
    "package" VARCHAR(255) NOT NULL,
    "version" VARCHAR(100) NOT NULL,
    "fix_available" BOOLEAN NOT NULL DEFAULT false,
    "fixed_version" VARCHAR(100),
    "description" TEXT,
    "link" VARCHAR(500),
    "detected_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vulnerabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployments" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "environment_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 0,
    "status" "deployment_status" NOT NULL,
    "strategy" "deployment_strategy" NOT NULL DEFAULT 'ROLLING',
    "build_started_at" TIMESTAMPTZ,
    "build_completed_at" TIMESTAMPTZ,
    "build_image" VARCHAR(500),
    "deploy_started_at" TIMESTAMPTZ,
    "deploy_completed_at" TIMESTAMPTZ,
    "blue_environment_id" UUID,
    "green_environment_id" UUID,
    "active_environment" "active_environment",
    "canary_percentage" INTEGER,
    "canary_metrics" JSONB,
    "can_rollback" BOOLEAN NOT NULL DEFAULT true,
    "rolled_back_at" TIMESTAMPTZ,
    "rollback_reason" TEXT,
    "error" TEXT,
    "parent_id" UUID,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployment_urls" (
    "id" UUID NOT NULL,
    "deployment_id" UUID NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "is_preview" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deployment_urls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployment_metrics" (
    "id" UUID NOT NULL,
    "deployment_id" UUID NOT NULL,
    "build_time" INTEGER,
    "deploy_time" INTEGER,
    "bundle_size" BIGINT,
    "request_count" BIGINT NOT NULL DEFAULT 0,
    "error_count" BIGINT NOT NULL DEFAULT 0,
    "bandwidth" BIGINT NOT NULL DEFAULT 0,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deployment_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployment_comments" (
    "id" UUID NOT NULL,
    "deployment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "deployment_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "containers" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "deployment_id" UUID NOT NULL,
    "name" VARCHAR(255),
    "container_id" VARCHAR(100) NOT NULL,
    "image" VARCHAR(500) NOT NULL,
    "status" "container_status" NOT NULL DEFAULT 'CREATING',
    "container_number" INTEGER NOT NULL DEFAULT 1,
    "config" JSONB NOT NULL DEFAULT '{}',
    "env" JSONB,
    "health_status" "health_status",
    "health_checks" INTEGER NOT NULL DEFAULT 0,
    "health_fails" INTEGER NOT NULL DEFAULT 0,
    "last_health_check_at" TIMESTAMPTZ,
    "replaced_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "started_at" TIMESTAMPTZ,
    "stopped_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "containers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "port_mappings" (
    "id" UUID NOT NULL,
    "container_id" UUID NOT NULL,
    "container_port" INTEGER NOT NULL,
    "host_port" INTEGER,
    "protocol" "port_protocol" NOT NULL DEFAULT 'TCP',

    CONSTRAINT "port_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volume_mappings" (
    "id" UUID NOT NULL,
    "container_id" UUID NOT NULL,
    "source" VARCHAR(500) NOT NULL,
    "target" VARCHAR(500) NOT NULL,
    "mode" "volume_mode" NOT NULL DEFAULT 'RW',

    CONSTRAINT "volume_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_check_configs" (
    "id" UUID NOT NULL,
    "container_id" UUID NOT NULL,
    "test" VARCHAR(500) NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 30,
    "timeout" INTEGER NOT NULL DEFAULT 5,
    "retries" INTEGER NOT NULL DEFAULT 3,
    "start_period" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "health_check_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_attachments" (
    "id" UUID NOT NULL,
    "container_id" UUID NOT NULL,
    "network_name" VARCHAR(255) NOT NULL,
    "ip_address" VARCHAR(45),
    "mac_address" VARCHAR(17),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "network_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_limits" (
    "id" UUID NOT NULL,
    "container_id" UUID NOT NULL,
    "cpu_request" DOUBLE PRECISION,
    "memory_request" BIGINT,
    "cpu_limit" DOUBLE PRECISION,
    "memory_limit" BIGINT,
    "storage_limit" BIGINT,
    "bandwidth_limit" BIGINT,

    CONSTRAINT "resource_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "service_type" NOT NULL,
    "engine" VARCHAR(100),
    "version" INTEGER NOT NULL DEFAULT 0,
    "status" "service_status" NOT NULL DEFAULT 'CREATING',
    "config" JSONB NOT NULL DEFAULT '{}',
    "connection_host" VARCHAR(255),
    "connection_port" INTEGER,
    "connection_url" TEXT,
    "connection_username" VARCHAR(255),
    "connection_password" TEXT,
    "connection_database" VARCHAR(255),
    "resources_allocated" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_backups" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "type" "backup_type" NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "size" BIGINT NOT NULL,
    "status" "backup_status" NOT NULL,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "metadata" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "service_backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secrets" (
    "id" UUID NOT NULL,
    "project_id" UUID,
    "key" VARCHAR(255) NOT NULL,
    "encrypted_value" TEXT NOT NULL,
    "encryption_key_id" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "last_accessed_at" TIMESTAMPTZ,
    "access_count" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "secrets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environment_variables" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "environment_id" UUID,
    "key" VARCHAR(255) NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "environment_variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs" (
    "id" UUID NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_type" "source_type" NOT NULL,
    "source_id" UUID NOT NULL,
    "source_name" VARCHAR(255) NOT NULL,
    "level" "log_level" NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "trace_id" VARCHAR(100),
    "span_id" VARCHAR(100),
    "project_id" UUID,
    "deployment_id" UUID,
    "container_id" UUID,
    "service_id" UUID,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id","timestamp")
);

-- CreateTable
CREATE TABLE "build_logs" (
    "id" UUID NOT NULL,
    "deployment_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message" TEXT NOT NULL,
    "level" "log_level" NOT NULL DEFAULT 'INFO',
    "source" "build_log_source" NOT NULL DEFAULT 'BUILD',

    CONSTRAINT "build_logs_pkey" PRIMARY KEY ("id","timestamp")
);

-- CreateTable
CREATE TABLE "metrics" (
    "id" UUID NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_type" "source_type" NOT NULL,
    "source_id" UUID NOT NULL,
    "source_name" VARCHAR(255) NOT NULL,
    "metric" VARCHAR(255) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" VARCHAR(50),
    "labels" JSONB,
    "project_id" UUID,
    "container_id" UUID,
    "service_id" UUID,
    "deployment_id" UUID,

    CONSTRAINT "metrics_pkey" PRIMARY KEY ("id","timestamp")
);

-- CreateTable
CREATE TABLE "tracing_configs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "backend" "tracing_backend" NOT NULL,
    "endpoint" VARCHAR(500) NOT NULL,
    "sample_rate" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "capture_headers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "auto_instrument" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tracing_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "metric" VARCHAR(255) NOT NULL,
    "operator" "alert_operator" NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "duration" INTEGER NOT NULL,
    "severity" "alert_severity" NOT NULL,
    "source_type" "source_type",
    "source_id" UUID,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by" UUID,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "status" "alert_status" NOT NULL,
    "severity" "alert_severity" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "message" TEXT NOT NULL,
    "fired_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ,
    "acknowledged_at" TIMESTAMPTZ,
    "acknowledged_by" UUID,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_channels" (
    "id" UUID NOT NULL,
    "project_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "type" "channel_type" NOT NULL,
    "config" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "alert_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_channel_rules" (
    "id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "severities" "alert_severity"[],

    CONSTRAINT "alert_channel_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_notifications" (
    "id" UUID NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alert_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "status" "notification_status" NOT NULL,
    "sent_at" TIMESTAMPTZ,
    "error" TEXT,

    CONSTRAINT "alert_notifications_pkey" PRIMARY KEY ("id","timestamp")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "command" TEXT NOT NULL,
    "schedule" VARCHAR(100),
    "status" "job_status" NOT NULL DEFAULT 'IDLE',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMPTZ,
    "last_run_status" "job_run_status",
    "next_run_at" TIMESTAMPTZ,
    "timeout" INTEGER DEFAULT 3600,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "retry_delay" INTEGER NOT NULL DEFAULT 60,
    "env" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "status" "job_run_status" NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "output" TEXT,
    "error" TEXT,
    "exit_code" INTEGER,
    "triggered_by" "trigger_type" NOT NULL,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domains" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_token" VARCHAR(100),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "ssl_status" "ssl_status" NOT NULL DEFAULT 'PENDING',
    "ssl_issued_at" TIMESTAMPTZ,
    "ssl_expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_policies" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "source_selector" JSONB NOT NULL,
    "target_selector" JSONB NOT NULL,
    "action" "policy_action" NOT NULL,
    "protocol" VARCHAR(50),
    "ports" INTEGER[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "network_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "git_integrations" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "provider" "git_provider" NOT NULL,
    "repository" VARCHAR(255) NOT NULL,
    "branch" VARCHAR(255) NOT NULL DEFAULT 'main',
    "installation_id" VARCHAR(100),
    "auto_deploy" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "git_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "git_commits" (
    "id" UUID NOT NULL,
    "deployment_id" UUID NOT NULL,
    "sha" VARCHAR(40) NOT NULL,
    "message" TEXT NOT NULL,
    "author" VARCHAR(255) NOT NULL,
    "branch" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "git_commits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "secret" VARCHAR(255) NOT NULL,
    "events" "webhook_event"[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL,
    "webhook_id" UUID NOT NULL,
    "event" "webhook_event" NOT NULL,
    "payload" JSONB NOT NULL,
    "status_code" INTEGER,
    "response" TEXT,
    "error" TEXT,
    "delivered_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id","created_at")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" UUID NOT NULL,
    "project_id" UUID,
    "type" "integration_type" NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "config" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "build_caches" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "size" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "last_used_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "build_caches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "project_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "key_hash" VARCHAR(255) NOT NULL,
    "prefix" VARCHAR(20) NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rate_limit" INTEGER,
    "last_used_at" TIMESTAMPTZ,
    "usage_count" BIGINT NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "user_email" VARCHAR(255),
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "action" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(100) NOT NULL,
    "resource_id" UUID,
    "changes" JSONB,
    "metadata" JSONB,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "project_id" UUID,
    "team_id" UUID,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id","timestamp")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "teams_slug_key" ON "teams"("slug");

-- CreateIndex
CREATE INDEX "teams_slug_idx" ON "teams"("slug");

-- CreateIndex
CREATE INDEX "team_members_team_id_idx" ON "team_members"("team_id");

-- CreateIndex
CREATE INDEX "team_members_user_id_idx" ON "team_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_team_id_user_id_key" ON "team_members"("team_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_resource_action_key" ON "permissions"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "role_assignments_user_id_idx" ON "role_assignments"("user_id");

-- CreateIndex
CREATE INDEX "role_assignments_resource_type_resource_id_idx" ON "role_assignments"("resource_type", "resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_assignments_user_id_role_id_resource_type_resource_id_key" ON "role_assignments"("user_id", "role_id", "resource_type", "resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_name_key" ON "projects"("name");

-- CreateIndex
CREATE INDEX "projects_name_idx" ON "projects"("name");

-- CreateIndex
CREATE INDEX "projects_team_id_idx" ON "projects"("team_id");

-- CreateIndex
CREATE INDEX "projects_created_at_idx" ON "projects"("created_at");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "projects_created_by_idx" ON "projects"("created_by");

-- CreateIndex
CREATE INDEX "projects_deleted_at_idx" ON "projects"("deleted_at");

-- CreateIndex
CREATE INDEX "projects_config_idx" ON "projects" USING GIN ("config" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "projects_metadata_idx" ON "projects" USING GIN ("metadata" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "environments_project_id_idx" ON "environments"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "environments_project_id_slug_key" ON "environments"("project_id", "slug");

-- CreateIndex
CREATE INDEX "registries_type_idx" ON "registries"("type");

-- CreateIndex
CREATE INDEX "registries_is_default_idx" ON "registries"("is_default");

-- CreateIndex
CREATE INDEX "images_project_id_idx" ON "images"("project_id");

-- CreateIndex
CREATE INDEX "images_scan_status_idx" ON "images"("scan_status");

-- CreateIndex
CREATE UNIQUE INDEX "images_registry_id_repository_tag_key" ON "images"("registry_id", "repository", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "images_digest_key" ON "images"("digest");

-- CreateIndex
CREATE INDEX "vulnerabilities_image_id_idx" ON "vulnerabilities"("image_id");

-- CreateIndex
CREATE INDEX "vulnerabilities_severity_idx" ON "vulnerabilities"("severity");

-- CreateIndex
CREATE INDEX "vulnerabilities_cve_id_idx" ON "vulnerabilities"("cve_id");

-- CreateIndex
CREATE INDEX "deployments_project_id_idx" ON "deployments"("project_id");

-- CreateIndex
CREATE INDEX "deployments_environment_id_idx" ON "deployments"("environment_id");

-- CreateIndex
CREATE INDEX "deployments_status_idx" ON "deployments"("status");

-- CreateIndex
CREATE INDEX "deployments_created_at_idx" ON "deployments"("created_at");

-- CreateIndex
CREATE INDEX "deployments_created_by_idx" ON "deployments"("created_by");

-- CreateIndex
CREATE INDEX "deployments_parent_id_idx" ON "deployments"("parent_id");

-- CreateIndex
CREATE INDEX "deployments_deleted_at_idx" ON "deployments"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "deployments_project_id_version_key" ON "deployments"("project_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "deployment_urls_url_key" ON "deployment_urls"("url");

-- CreateIndex
CREATE INDEX "deployment_urls_deployment_id_idx" ON "deployment_urls"("deployment_id");

-- CreateIndex
CREATE INDEX "deployment_metrics_deployment_id_recorded_at_idx" ON "deployment_metrics"("deployment_id", "recorded_at");

-- CreateIndex
CREATE INDEX "deployment_comments_deployment_id_idx" ON "deployment_comments"("deployment_id");

-- CreateIndex
CREATE INDEX "deployment_comments_user_id_idx" ON "deployment_comments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "containers_container_id_key" ON "containers"("container_id");

-- CreateIndex
CREATE INDEX "containers_project_id_idx" ON "containers"("project_id");

-- CreateIndex
CREATE INDEX "containers_deployment_id_idx" ON "containers"("deployment_id");

-- CreateIndex
CREATE INDEX "containers_container_id_idx" ON "containers"("container_id");

-- CreateIndex
CREATE INDEX "containers_name_idx" ON "containers"("name");

-- CreateIndex
CREATE INDEX "containers_status_idx" ON "containers"("status");

-- CreateIndex
CREATE INDEX "containers_created_by_idx" ON "containers"("created_by");

-- CreateIndex
CREATE INDEX "containers_config_idx" ON "containers" USING GIN ("config" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "containers_env_idx" ON "containers" USING GIN ("env" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "port_mappings_container_id_idx" ON "port_mappings"("container_id");

-- CreateIndex
CREATE INDEX "port_mappings_host_port_protocol_idx" ON "port_mappings"("host_port", "protocol");

-- CreateIndex
CREATE INDEX "volume_mappings_container_id_idx" ON "volume_mappings"("container_id");

-- CreateIndex
CREATE UNIQUE INDEX "health_check_configs_container_id_key" ON "health_check_configs"("container_id");

-- CreateIndex
CREATE INDEX "health_check_configs_container_id_idx" ON "health_check_configs"("container_id");

-- CreateIndex
CREATE INDEX "network_attachments_container_id_idx" ON "network_attachments"("container_id");

-- CreateIndex
CREATE INDEX "network_attachments_network_name_idx" ON "network_attachments"("network_name");

-- CreateIndex
CREATE UNIQUE INDEX "resource_limits_container_id_key" ON "resource_limits"("container_id");

-- CreateIndex
CREATE INDEX "services_project_id_idx" ON "services"("project_id");

-- CreateIndex
CREATE INDEX "services_type_idx" ON "services"("type");

-- CreateIndex
CREATE INDEX "services_status_idx" ON "services"("status");

-- CreateIndex
CREATE INDEX "services_deleted_at_idx" ON "services"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "services_project_id_name_key" ON "services"("project_id", "name");

-- CreateIndex
CREATE INDEX "service_backups_service_id_created_at_idx" ON "service_backups"("service_id", "created_at");

-- CreateIndex
CREATE INDEX "service_backups_status_idx" ON "service_backups"("status");

-- CreateIndex
CREATE INDEX "secrets_project_id_idx" ON "secrets"("project_id");

-- CreateIndex
CREATE INDEX "secrets_key_idx" ON "secrets"("key");

-- CreateIndex
CREATE INDEX "secrets_created_by_idx" ON "secrets"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "secrets_project_id_key_key" ON "secrets"("project_id", "key");

-- CreateIndex
CREATE INDEX "environment_variables_project_id_idx" ON "environment_variables"("project_id");

-- CreateIndex
CREATE INDEX "environment_variables_environment_id_idx" ON "environment_variables"("environment_id");

-- CreateIndex
CREATE UNIQUE INDEX "environment_variables_project_id_environment_id_key_key" ON "environment_variables"("project_id", "environment_id", "key");

-- CreateIndex
CREATE INDEX "logs_timestamp_idx" ON "logs"("timestamp");

-- CreateIndex
CREATE INDEX "logs_source_type_source_id_idx" ON "logs"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "logs_level_idx" ON "logs"("level");

-- CreateIndex
CREATE INDEX "logs_trace_id_idx" ON "logs"("trace_id");

-- CreateIndex
CREATE INDEX "logs_project_id_timestamp_idx" ON "logs"("project_id", "timestamp");

-- CreateIndex
CREATE INDEX "build_logs_deployment_id_timestamp_idx" ON "build_logs"("deployment_id", "timestamp");

-- CreateIndex
CREATE INDEX "build_logs_timestamp_idx" ON "build_logs"("timestamp");

-- CreateIndex
CREATE INDEX "build_logs_level_idx" ON "build_logs"("level");

-- CreateIndex
CREATE UNIQUE INDEX "build_logs_deployment_id_line_number_timestamp_key" ON "build_logs"("deployment_id", "line_number", "timestamp");

-- CreateIndex
CREATE INDEX "metrics_timestamp_idx" ON "metrics"("timestamp");

-- CreateIndex
CREATE INDEX "metrics_source_type_source_id_idx" ON "metrics"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "metrics_metric_idx" ON "metrics"("metric");

-- CreateIndex
CREATE INDEX "metrics_project_id_timestamp_idx" ON "metrics"("project_id", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "tracing_configs_project_id_key" ON "tracing_configs"("project_id");

-- CreateIndex
CREATE INDEX "alert_rules_project_id_idx" ON "alert_rules"("project_id");

-- CreateIndex
CREATE INDEX "alert_rules_enabled_idx" ON "alert_rules"("enabled");

-- CreateIndex
CREATE INDEX "alerts_rule_id_idx" ON "alerts"("rule_id");

-- CreateIndex
CREATE INDEX "alerts_status_idx" ON "alerts"("status");

-- CreateIndex
CREATE INDEX "alerts_fired_at_idx" ON "alerts"("fired_at");

-- CreateIndex
CREATE INDEX "alert_channels_project_id_idx" ON "alert_channels"("project_id");

-- CreateIndex
CREATE INDEX "alert_channels_type_idx" ON "alert_channels"("type");

-- CreateIndex
CREATE UNIQUE INDEX "alert_channel_rules_rule_id_channel_id_key" ON "alert_channel_rules"("rule_id", "channel_id");

-- CreateIndex
CREATE INDEX "alert_notifications_alert_id_idx" ON "alert_notifications"("alert_id");

-- CreateIndex
CREATE INDEX "alert_notifications_status_idx" ON "alert_notifications"("status");

-- CreateIndex
CREATE INDEX "jobs_project_id_idx" ON "jobs"("project_id");

-- CreateIndex
CREATE INDEX "jobs_schedule_idx" ON "jobs"("schedule");

-- CreateIndex
CREATE INDEX "jobs_next_run_at_idx" ON "jobs"("next_run_at");

-- CreateIndex
CREATE INDEX "jobs_enabled_idx" ON "jobs"("enabled");

-- CreateIndex
CREATE INDEX "jobs_env_idx" ON "jobs" USING GIN ("env" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "job_runs_job_id_started_at_idx" ON "job_runs"("job_id", "started_at");

-- CreateIndex
CREATE INDEX "job_runs_status_idx" ON "job_runs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "domains_domain_key" ON "domains"("domain");

-- CreateIndex
CREATE INDEX "domains_project_id_idx" ON "domains"("project_id");

-- CreateIndex
CREATE INDEX "domains_domain_idx" ON "domains"("domain");

-- CreateIndex
CREATE INDEX "domains_verified_idx" ON "domains"("verified");

-- CreateIndex
CREATE INDEX "network_policies_project_id_idx" ON "network_policies"("project_id");

-- CreateIndex
CREATE INDEX "network_policies_priority_idx" ON "network_policies"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "git_integrations_project_id_key" ON "git_integrations"("project_id");

-- CreateIndex
CREATE INDEX "git_integrations_repository_idx" ON "git_integrations"("repository");

-- CreateIndex
CREATE UNIQUE INDEX "git_commits_deployment_id_key" ON "git_commits"("deployment_id");

-- CreateIndex
CREATE INDEX "git_commits_sha_idx" ON "git_commits"("sha");

-- CreateIndex
CREATE INDEX "git_commits_branch_idx" ON "git_commits"("branch");

-- CreateIndex
CREATE INDEX "webhooks_project_id_idx" ON "webhooks"("project_id");

-- CreateIndex
CREATE INDEX "webhook_deliveries_webhook_id_created_at_idx" ON "webhook_deliveries"("webhook_id", "created_at");

-- CreateIndex
CREATE INDEX "integrations_project_id_idx" ON "integrations"("project_id");

-- CreateIndex
CREATE INDEX "integrations_type_idx" ON "integrations"("type");

-- CreateIndex
CREATE INDEX "integrations_config_idx" ON "integrations" USING GIN ("config" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "build_caches_expires_at_idx" ON "build_caches"("expires_at");

-- CreateIndex
CREATE INDEX "build_caches_last_used_at_idx" ON "build_caches"("last_used_at");

-- CreateIndex
CREATE INDEX "build_caches_deleted_at_idx" ON "build_caches"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "build_caches_project_id_key_key" ON "build_caches"("project_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");

-- CreateIndex
CREATE INDEX "api_keys_project_id_idx" ON "api_keys"("project_id");

-- CreateIndex
CREATE INDEX "api_keys_prefix_idx" ON "api_keys"("prefix");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_project_id_idx" ON "audit_logs"("project_id");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environments" ADD CONSTRAINT "environments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registries" ADD CONSTRAINT "registries_password_secret_id_fkey" FOREIGN KEY ("password_secret_id") REFERENCES "secrets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registries" ADD CONSTRAINT "registries_token_secret_id_fkey" FOREIGN KEY ("token_secret_id") REFERENCES "secrets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_registry_id_fkey" FOREIGN KEY ("registry_id") REFERENCES "registries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vulnerabilities" ADD CONSTRAINT "vulnerabilities_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "images"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "deployments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment_urls" ADD CONSTRAINT "deployment_urls_deployment_id_fkey" FOREIGN KEY ("deployment_id") REFERENCES "deployments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment_metrics" ADD CONSTRAINT "deployment_metrics_deployment_id_fkey" FOREIGN KEY ("deployment_id") REFERENCES "deployments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment_comments" ADD CONSTRAINT "deployment_comments_deployment_id_fkey" FOREIGN KEY ("deployment_id") REFERENCES "deployments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "containers" ADD CONSTRAINT "containers_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "containers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "containers" ADD CONSTRAINT "containers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "containers" ADD CONSTRAINT "containers_deployment_id_fkey" FOREIGN KEY ("deployment_id") REFERENCES "deployments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "port_mappings" ADD CONSTRAINT "port_mappings_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volume_mappings" ADD CONSTRAINT "volume_mappings_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_check_configs" ADD CONSTRAINT "health_check_configs_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_attachments" ADD CONSTRAINT "network_attachments_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_limits" ADD CONSTRAINT "resource_limits_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_backups" ADD CONSTRAINT "service_backups_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secrets" ADD CONSTRAINT "secrets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environment_variables" ADD CONSTRAINT "environment_variables_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environment_variables" ADD CONSTRAINT "environment_variables_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "environments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_logs" ADD CONSTRAINT "build_logs_deployment_id_fkey" FOREIGN KEY ("deployment_id") REFERENCES "deployments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracing_configs" ADD CONSTRAINT "tracing_configs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_channels" ADD CONSTRAINT "alert_channels_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_channel_rules" ADD CONSTRAINT "alert_channel_rules_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_channel_rules" ADD CONSTRAINT "alert_channel_rules_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "alert_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_notifications" ADD CONSTRAINT "alert_notifications_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_notifications" ADD CONSTRAINT "alert_notifications_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "alert_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domains" ADD CONSTRAINT "domains_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_policies" ADD CONSTRAINT "network_policies_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "git_integrations" ADD CONSTRAINT "git_integrations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "git_commits" ADD CONSTRAINT "git_commits_deployment_id_fkey" FOREIGN KEY ("deployment_id") REFERENCES "deployments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_caches" ADD CONSTRAINT "build_caches_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
