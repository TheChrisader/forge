import type { Project, Deployment, DbContainer, Service, CreateProjectRequest } from "@forge/types";

let projectCounter = 0;
let deploymentCounter = 0;
let serviceCounter = 0;
let containerCounter = 0;

/**
 * Reset all factory counters
 * Call this in beforeEach or afterAll to ensure consistent IDs
 */
export function resetFactories(): void {
  projectCounter = 0;
  deploymentCounter = 0;
  serviceCounter = 0;
  containerCounter = 0;
}

export function createTestProject(overrides?: Partial<Project>): Omit<
  Project,
  "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy"
> & {
  id?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
} {
  projectCounter++;

  return {
    id: overrides?.id ?? `test-project-${projectCounter}`,
    name: overrides?.name ?? `Test Project ${projectCounter}`,
    type: overrides?.type ?? "nodejs",
    status: overrides?.status ?? "active",
    config: overrides?.config ?? null,
    metadata: overrides?.metadata ?? null,
    createdBy: overrides?.createdBy ?? null,
    updatedBy: overrides?.updatedBy ?? null,
  };
}

export function createTestDeployment(overrides?: Partial<Deployment>): Omit<
  Deployment,
  "id" | "createdAt" | "createdBy" | "updatedBy" | "error"
> & {
  id?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  error?: string | null;
} {
  deploymentCounter++;

  return {
    id: overrides?.id ?? `test-deployment-${deploymentCounter}`,
    projectId: overrides?.projectId ?? `test-project-${projectCounter}`,
    version: overrides?.version ?? `v1.0.${deploymentCounter}`,
    status: overrides?.status ?? "pending",
    buildStartedAt: overrides?.buildStartedAt ?? null,
    buildCompletedAt: overrides?.buildCompletedAt ?? null,
    buildImage: overrides?.buildImage ?? null,
    buildLogs: overrides?.buildLogs ?? null,
    deployStartedAt: overrides?.deployStartedAt ?? null,
    deployCompletedAt: overrides?.deployCompletedAt ?? null,
    createdBy: overrides?.createdBy ?? null,
    updatedBy: overrides?.updatedBy ?? null,
    error: overrides?.error ?? null,
  };
}

export function createTestService(overrides?: Partial<Service>): Service {
  serviceCounter++;

  return {
    id: overrides?.id ?? `test-service-${serviceCounter}`,
    projectId: overrides?.projectId ?? `test-project-${projectCounter}`,
    name: overrides?.name ?? `test-service-${serviceCounter}`,
    type: overrides?.type ?? "database",
    engine: overrides?.engine ?? "postgres",
    version: overrides?.version ?? "17",
    status: overrides?.status ?? "running",
    config: overrides?.config ?? {},
    connection: overrides?.connection,
    createdAt: overrides?.createdAt ?? new Date().toISOString(),
    updatedAt: overrides?.updatedAt ?? new Date().toISOString(),
  };
}

export function createTestContainer(
  overrides?: Partial<DbContainer>
): Omit<DbContainer, "id" | "createdAt" | "updatedAt"> & { id?: string } {
  containerCounter++;
  return {
    id: overrides?.id ?? `test-container-${containerCounter}`,
    projectId: overrides?.projectId ?? `test-project-${projectCounter}`,
    deploymentId: overrides?.deploymentId ?? `test-deployment-${deploymentCounter}`,
    name: overrides?.name ?? `test-container-${containerCounter}`,
    containerId: overrides?.containerId ?? `docker-container-${containerCounter}`,
    image: overrides?.image ?? "test-image:latest",
    status: overrides?.status ?? "running",
    config: overrides?.config ?? {},
    ports: overrides?.ports ?? null,
    volumes: overrides?.volumes ?? null,
    network: overrides?.network ?? null,
    env: overrides?.env ?? null,
    healthStatus: overrides?.healthStatus ?? null,
    healthChecks: overrides?.healthChecks ?? 0,
    healthFails: overrides?.healthFails ?? 0,
    startedAt: overrides?.startedAt ?? null,
    stoppedAt: overrides?.stoppedAt ?? null,
    deletedAt: overrides?.deletedAt ?? null,
    createdBy: overrides?.createdBy ?? null,
    updatedBy: overrides?.updatedBy ?? null,
  };
}

export function createProjectRequest(
  overrides?: Partial<CreateProjectRequest>
): CreateProjectRequest {
  projectCounter++;

  return {
    name: overrides?.name ?? `Test Project ${projectCounter}`,
    type: overrides?.type ?? "nodejs",
    config: overrides?.config ?? {},
    metadata: overrides?.metadata ?? {},
    ...overrides,
  };
}

export function createTestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function createTestTimestamps(): { createdAt: Date; updatedAt: Date } {
  const now = new Date();
  return { createdAt: now, updatedAt: now };
}
