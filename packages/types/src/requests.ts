import type { DeploymentStrategy, ServiceType } from "./entities";

export interface CreateProjectRequest {
  name: string;
  type?: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateProjectRequest {
  name?: string;
  type?: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface DeployProjectRequest {
  version?: string;
  strategy?: DeploymentStrategy;
  gitUrl?: string;
  branch?: string;
}

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
