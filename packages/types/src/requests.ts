import type { DeploymentStrategy, ServiceType } from "./entities";

// =============================================================================
// Project Requests
// =============================================================================

export interface CreateProjectRequest {
  name: string;
  type?: string; // get rid o' this
  sourceType?: string;
  sourceUrl?: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateProjectRequest {
  name?: string;
  type?: string;
  sourceType?: string;
  sourceUrl?: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Deployment Requests
// =============================================================================

export interface DeployProjectRequest {
  version?: string;
  strategy?: DeploymentStrategy;
  gitUrl?: string;
  branch?: string;
}

export interface CreateDeploymentRequest {
  projectId: string;
  version: string;
}

export interface UpdateDeploymentRequest {
  status?: string;
  buildStartedAt?: Date;
  buildCompletedAt?: Date;
  buildImage?: string;
  buildLogs?: string;
  deployStartedAt?: Date;
  deployCompletedAt?: Date;
  error?: string;
}

// =============================================================================
// Container Requests
// =============================================================================

export interface CreateContainerRequest {
  deploymentId: string;
  name?: string;
  image: string;
  config?: Record<string, unknown>;
  env?: Record<string, unknown>;
}

export interface UpdateContainerRequest {
  name?: string;
  status?: string;
  config?: Record<string, unknown>;
  env?: Record<string, unknown>;
}

// =============================================================================
// Service Requests (not in database - domain entities)
// =============================================================================

export interface CreateServiceRequest {
  projectId: string;
  name: string;
  type: ServiceType;
  engine?: string;
  version?: string;
  config?: Record<string, unknown>;
}

export interface UpdateServiceRequest {
  name?: string;
  config?: Record<string, unknown>;
}

// =============================================================================
// Secret Requests (not in database - domain entities)
// =============================================================================

export interface CreateSecretRequest {
  projectId?: string;
  key: string;
  value: string;
  description?: string;
}

export interface UpdateSecretRequest {
  value?: string;
  description?: string;
}

// =============================================================================
// Job Requests (not in database - domain entities)
// =============================================================================

export interface CreateJobRequest {
  projectId: string;
  name: string;
  command: string;
  schedule?: string;
  enabled?: boolean;
}

export interface UpdateJobRequest {
  name?: string;
  command?: string;
  schedule?: string;
  enabled?: boolean;
}
