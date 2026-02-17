/**
 * Service layer interfaces
 * Define contracts for all business logic services
 */

import type {
  Project,
  ProjectWithRelations,
  Deployment,
  Service,
  DockerContainer,
  CreateProjectRequest,
  UpdateProjectRequest,
  DeployProjectRequest,
} from "@forge/types";

export interface IProjectService {
  create(data: CreateProjectRequest): Promise<Project>;
  update(id: string, data: UpdateProjectRequest): Promise<Project>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<ProjectWithRelations | null>;
  list(filters?: {
    page?: number;
    limit?: number;
    status?: string[];
  }): Promise<{ projects: Project[]; total: number }>;
  deploy(id: string, data?: DeployProjectRequest): Promise<Deployment>;
  rollback(id: string, deploymentId?: string): Promise<Deployment>;
  scale(id: string, replicas: number): Promise<void>;
}

export interface IDeploymentService {
  create(projectId: string, version: string): Promise<Deployment>;
  getById(id: string): Promise<Deployment | null>;
  getByProject(projectId: string): Promise<Deployment[]>;
  updateStatus(id: string, status: string, error?: string): Promise<Deployment>;
  cancel(id: string): Promise<void>;
  getLogs(id: string): Promise<string>;
}

export interface IServiceManagementService {
  create(data: { projectId: string; type: string; engine?: string }): Promise<Service>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<Service | null>;
  getByProject(projectId: string): Promise<Service[]>;
  getConnection(id: string): Promise<{
    host: string;
    port: number;
    url?: string;
  }>;
  start(id: string): Promise<void>;
  stop(id: string): Promise<void>;
  restart(id: string): Promise<void>;
}

export interface IContainerService {
  create(config: {
    projectId: string;
    deploymentId: string;
    image: string;
  }): Promise<DockerContainer>;
  start(id: string): Promise<void>;
  stop(id: string): Promise<void>;
  restart(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  getById(id: string): Promise<DockerContainer | null>;
  getByProject(projectId: string): Promise<DockerContainer[]>;
  getByDeployment(deploymentId: string): Promise<DockerContainer[]>;
  getLogs(id: string, tail?: number): Promise<string[]>;
  getStats(id: string): Promise<{
    cpu: number;
    memory: number;
    network: { rx: number; tx: number };
  }>;
  exec(id: string, command: string[]): Promise<{ exitCode: number; output: string }>;
}

export interface ILogService {
  query(filters: {
    projectId?: string;
    deploymentId?: string;
    containerId?: string;
    level?: string;
    since?: Date;
    until?: Date;
    limit?: number;
  }): Promise<
    Array<{
      timestamp: Date;
      level: string;
      message: string;
      source: string;
    }>
  >;
  stream(
    filters: {
      projectId?: string;
      deploymentId?: string;
      containerId?: string;
    },
    callback: (log: unknown) => void
  ): Promise<() => void>; // Returns unsubscribe function
}

export interface IMetricsService {
  query(filters: {
    source?: string;
    metric?: string;
    from: Date;
    to: Date;
    interval?: string;
  }): Promise<
    Array<{
      timestamp: Date;
      metric: string;
      value: number;
      labels?: Record<string, string>;
    }>
  >;
  record(metric: {
    source: string;
    name: string;
    value: number;
    labels?: Record<string, string>;
  }): Promise<void>;
}

export interface ISecretService {
  create(data: {
    projectId?: string;
    key: string;
    value: string;
  }): Promise<{ id: string; key: string }>;
  update(id: string, value: string): Promise<void>;
  delete(id: string): Promise<void>;
  get(id: string): Promise<string>; // Returns decrypted value
  list(projectId?: string): Promise<
    Array<{
      id: string;
      key: string;
      projectId?: string;
    }>
  >;
}
