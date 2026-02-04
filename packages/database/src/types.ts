import type { Project, Deployment, Container } from "./generated/client";

// Re-export Prisma types
export type { Project, Deployment, Container };

// Custom types for operations
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
