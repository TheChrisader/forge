import { z } from "zod";
import type { DeploymentStrategy } from "./entities";
import {
  CreateProjectRequestSchema,
  UpdateProjectRequestSchema,
  CreateDeploymentRequestSchema,
  UpdateDeploymentRequestSchema,
  CreateDeploymentUrlRequestSchema,
  CreateDeploymentCommentRequestSchema,
  UpdateDeploymentCommentRequestSchema,
  CreateContainerRequestSchema,
  UpdateContainerRequestSchema,
  CreatePortMappingRequestSchema,
  CreateVolumeMappingRequestSchema,
  CreateHealthCheckConfigRequestSchema,
  UpdateHealthCheckConfigRequestSchema,
  CreateNetworkAttachmentRequestSchema,
  UpdateNetworkAttachmentRequestSchema,
  CreateResourceLimitRequestSchema,
  UpdateResourceLimitRequestSchema,
  CreateServiceRequestSchema,
  CreateServiceBackupRequestSchema,
  UpdateServiceBackupRequestSchema,
  CreateSecretRequestSchema,
  UpdateSecretRequestSchema,
  CreateEnvironmentVariableRequestSchema,
  UpdateEnvironmentVariableRequestSchema,
  CreateTracingConfigRequestSchema,
  UpdateTracingConfigRequestSchema,
  CreateAlertRuleRequestSchema,
  UpdateAlertRuleRequestSchema,
  CreateAlertRequestSchema,
  UpdateAlertRequestSchema,
  CreateAlertChannelRequestSchema,
  UpdateAlertChannelRequestSchema,
  CreateAlertChannelRuleRequestSchema,
  UpdateAlertChannelRuleRequestSchema,
  CreateJobRequestSchema,
  UpdateJobRequestSchema,
  CreateJobRunRequestSchema,
  CreateDomainRequestSchema,
  UpdateDomainRequestSchema,
  CreateNetworkPolicyRequestSchema,
  UpdateNetworkPolicyRequestSchema,
  CreateGitIntegrationRequestSchema,
  UpdateGitIntegrationRequestSchema,
  CreateWebhookRequestSchema,
  UpdateWebhookRequestSchema,
  CreateIntegrationRequestSchema,
  UpdateIntegrationRequestSchema,
  CreateApiKeyRequestSchema,
  CreateRegistryRequestSchema,
  UpdateRegistryRequestSchema,
  CreateImageRequestSchema,
  UpdateImageRequestSchema,
  CreateEnvironmentRequestSchema,
  UpdateEnvironmentRequestSchema,
  CreateUserRequestSchema,
  UpdateUserRequestSchema,
  CreateTeamRequestSchema,
  UpdateTeamRequestSchema,
  CreateTeamMemberRequestSchema,
  UpdateTeamMemberRequestSchema,
  CreateRoleRequestSchema,
  UpdateRoleRequestSchema,
  CreatePermissionRequestSchema,
  UpdatePermissionRequestSchema,
  CreateRolePermissionRequestSchema,
  CreateRoleAssignmentRequestSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  AuthMeResponseSchema,
} from "./schemas";

// =============================================================================
// Authentication
// =============================================================================

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>;

// =============================================================================
// Project Requests
// =============================================================================

export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

export type UpdateProjectRequest = z.infer<typeof UpdateProjectRequestSchema>;

export type CreateEnvironmentRequest = z.infer<typeof CreateEnvironmentRequestSchema>;

export type UpdateEnvironmentRequest = z.infer<typeof UpdateEnvironmentRequestSchema>;

// =============================================================================
// Deployment Requests
// =============================================================================

export interface DeployProjectRequest {
  version?: string;
  strategy?: DeploymentStrategy;
  gitUrl?: string;
  branch?: string;
}

export type CreateDeploymentRequest = z.infer<typeof CreateDeploymentRequestSchema>;

export type UpdateDeploymentRequest = z.infer<typeof UpdateDeploymentRequestSchema>;

export type CreateDeploymentUrlRequest = z.infer<typeof CreateDeploymentUrlRequestSchema>;

export type CreateDeploymentCommentRequest = z.infer<typeof CreateDeploymentCommentRequestSchema>;

export type UpdateDeploymentCommentRequest = z.infer<typeof UpdateDeploymentCommentRequestSchema>;

// =============================================================================
// Container Requests
// =============================================================================

export type CreateContainerRequest = z.infer<typeof CreateContainerRequestSchema>;

export type UpdateContainerRequest = z.infer<typeof UpdateContainerRequestSchema>;

export type CreatePortMappingRequest = z.infer<typeof CreatePortMappingRequestSchema>;

export type CreateVolumeMappingRequest = z.infer<typeof CreateVolumeMappingRequestSchema>;

export type CreateHealthCheckConfigRequest = z.infer<typeof CreateHealthCheckConfigRequestSchema>;

export type UpdateHealthCheckConfigRequest = z.infer<typeof UpdateHealthCheckConfigRequestSchema>;

export type CreateNetworkAttachmentRequest = z.infer<typeof CreateNetworkAttachmentRequestSchema>;

export type UpdateNetworkAttachmentRequest = z.infer<typeof UpdateNetworkAttachmentRequestSchema>;

export type CreateResourceLimitRequest = z.infer<typeof CreateResourceLimitRequestSchema>;

// =============================================================================
// Container Registry & Images
// =============================================================================

export type CreateRegistryRequest = z.infer<typeof CreateRegistryRequestSchema>;

export type UpdateRegistryRequest = z.infer<typeof UpdateRegistryRequestSchema>;

export type CreateImageRequest = z.infer<typeof CreateImageRequestSchema>;

export type UpdateImageRequest = z.infer<typeof UpdateImageRequestSchema>;

// =============================================================================
// Services (Database, Cache, Queue, etc.)
// =============================================================================

export type CreateServiceRequest = z.infer<typeof CreateServiceRequestSchema>;

export type CreateServiceBackupRequest = z.infer<typeof CreateServiceBackupRequestSchema>;

export type UpdateServiceBackupRequest = z.infer<typeof UpdateServiceBackupRequestSchema>;

// =============================================================================
// Secrets & Environment Variables
// =============================================================================

export type CreateSecretRequest = z.infer<typeof CreateSecretRequestSchema>;

export type UpdateSecretRequest = z.infer<typeof UpdateSecretRequestSchema>;

export type CreateEnvironmentVariableRequest = z.infer<
  typeof CreateEnvironmentVariableRequestSchema
>;

export type UpdateEnvironmentVariableRequest = z.infer<
  typeof UpdateEnvironmentVariableRequestSchema
>;

// =============================================================================
// Observability (Logs, Metrics, Tracing)
// =============================================================================

export type CreateTracingConfigRequest = z.infer<typeof CreateTracingConfigRequestSchema>;

export type UpdateTracingConfigRequest = z.infer<typeof UpdateTracingConfigRequestSchema>;

// =============================================================================
// Alerting
// =============================================================================

export type CreateAlertRuleRequest = z.infer<typeof CreateAlertRuleRequestSchema>;

export type UpdateAlertRuleRequest = z.infer<typeof UpdateAlertRuleRequestSchema>;

export type CreateAlertRequest = z.infer<typeof CreateAlertRequestSchema>;

export type UpdateAlertRequest = z.infer<typeof UpdateAlertRequestSchema>;

export type CreateAlertChannelRequest = z.infer<typeof CreateAlertChannelRequestSchema>;

export type UpdateAlertChannelRequest = z.infer<typeof UpdateAlertChannelRequestSchema>;

export type CreateAlertChannelRuleRequest = z.infer<typeof CreateAlertChannelRuleRequestSchema>;

export type UpdateAlertChannelRuleRequest = z.infer<typeof UpdateAlertChannelRuleRequestSchema>;

// =============================================================================
// Jobs & Automation
// =============================================================================

export type CreateJobRequest = z.infer<typeof CreateJobRequestSchema>;

export type UpdateJobRequest = z.infer<typeof UpdateJobRequestSchema>;

export type CreateJobRunRequest = z.infer<typeof CreateJobRunRequestSchema>;

// =============================================================================
// Domains & Networking
// =============================================================================

export type CreateDomainRequest = z.infer<typeof CreateDomainRequestSchema>;

export type UpdateDomainRequest = z.infer<typeof UpdateDomainRequestSchema>;

export type CreateNetworkPolicyRequest = z.infer<typeof CreateNetworkPolicyRequestSchema>;

export type UpdateNetworkPolicyRequest = z.infer<typeof UpdateNetworkPolicyRequestSchema>;

// =============================================================================
// Git Integration
// =============================================================================

export type CreateGitIntegrationRequest = z.infer<typeof CreateGitIntegrationRequestSchema>;

export type UpdateGitIntegrationRequest = z.infer<typeof UpdateGitIntegrationRequestSchema>;

// =============================================================================
// Webhooks
// =============================================================================

export type CreateWebhookRequest = z.infer<typeof CreateWebhookRequestSchema>;

export type UpdateWebhookRequest = z.infer<typeof UpdateWebhookRequestSchema>;

// =============================================================================
// Integrations
// =============================================================================

export type CreateIntegrationRequest = z.infer<typeof CreateIntegrationRequestSchema>;

export type UpdateIntegrationRequest = z.infer<typeof UpdateIntegrationRequestSchema>;

// =============================================================================
// API Keys
// =============================================================================

export type CreateApiKeyRequest = z.infer<typeof CreateApiKeyRequestSchema>;

// =============================================================================
// User & Team Management
// =============================================================================

export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;

export type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>;

export type CreateTeamRequest = z.infer<typeof CreateTeamRequestSchema>;

export type UpdateTeamRequest = z.infer<typeof UpdateTeamRequestSchema>;

export type CreateTeamMemberRequest = z.infer<typeof CreateTeamMemberRequestSchema>;

export type UpdateTeamMemberRequest = z.infer<typeof UpdateTeamMemberRequestSchema>;

// =============================================================================
// RBAC (Role-Based Access Control)
// =============================================================================

export type CreateRoleRequest = z.infer<typeof CreateRoleRequestSchema>;

export type UpdateRoleRequest = z.infer<typeof UpdateRoleRequestSchema>;

export type CreatePermissionRequest = z.infer<typeof CreatePermissionRequestSchema>;

export type UpdatePermissionRequest = z.infer<typeof UpdatePermissionRequestSchema>;

export type CreateRolePermissionRequest = z.infer<typeof CreateRolePermissionRequestSchema>;

export type CreateRoleAssignmentRequest = z.infer<typeof CreateRoleAssignmentRequestSchema>;

export type UpdateResourceLimitRequest = z.infer<typeof UpdateResourceLimitRequestSchema>;
