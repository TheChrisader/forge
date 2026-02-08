import type { Project, Deployment, Container } from "./generated/client";

export type { Project, Deployment, Container };

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
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export interface UpdateProjectInput {
  name?: string;
  type?: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CreateDeploymentInput {
  projectId: string;
  version: string;
  createdBy?: string;
}

export interface UpdateDeploymentInput {
  status?: string;
  buildStartedAt?: Date;
  buildCompletedAt?: Date;
  buildImage?: string;
  buildLogs?: string;
  deployStartedAt?: Date;
  deployCompletedAt?: Date;
  error?: string;
}

export interface CreateContainerInput {
  deploymentId: string;
  name: string;
  image: string;
  status?: string;
}

export interface UpdateContainerInput {
  name?: string;
  status?: string;
}
