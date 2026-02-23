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
    status: overrides?.status ?? "ACTIVE",
    config: overrides?.config ?? null,
    metadata: overrides?.metadata ?? null,
    teamId: overrides?.teamId ?? null,
    sourceType: overrides?.sourceType ?? null,
    sourceUrl: overrides?.sourceUrl ?? null,
    deletedAt: overrides?.deletedAt ?? null,
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
    version: overrides?.version ?? deploymentCounter,
    status: overrides?.status ?? "PENDING",
    strategy: overrides?.strategy ?? "ROLLING",
    buildStartedAt: overrides?.buildStartedAt ?? null,
    buildCompletedAt: overrides?.buildCompletedAt ?? null,
    buildImage: overrides?.buildImage ?? null,
    deployStartedAt: overrides?.deployStartedAt ?? null,
    deployCompletedAt: overrides?.deployCompletedAt ?? null,
    environmentId: overrides?.environmentId ?? null,
    blueEnvironmentId: overrides?.blueEnvironmentId ?? null,
    greenEnvironmentId: overrides?.greenEnvironmentId ?? null,
    activeEnvironment: overrides?.activeEnvironment ?? null,
    canaryPercentage: overrides?.canaryPercentage ?? null,
    canaryMetrics: overrides?.canaryMetrics ?? null,
    canRollback: overrides?.canRollback ?? true,
    rolledBackAt: overrides?.rolledBackAt ?? null,
    rollbackReason: overrides?.rollbackReason ?? null,
    parentId: overrides?.parentId ?? null,
    deletedAt: overrides?.deletedAt ?? null,
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
    type: overrides?.type ?? "DATABASE",
    engine: overrides?.engine ?? "postgres",
    version: overrides?.version ?? 17,
    status: overrides?.status ?? "RUNNING",
    config: overrides?.config ?? {},
    connectionHost: overrides?.connectionHost ?? null,
    connectionPort: overrides?.connectionPort ?? null,
    connectionUrl: overrides?.connectionUrl ?? null,
    connectionUsername: overrides?.connectionUsername ?? null,
    connectionPassword: overrides?.connectionPassword ?? null,
    connectionDatabase: overrides?.connectionDatabase ?? null,
    resourcesAllocated: overrides?.resourcesAllocated ?? null,
    createdAt: overrides?.createdAt ?? new Date(),
    updatedAt: overrides?.updatedAt ?? new Date(),
    createdBy: overrides?.createdBy ?? null,
    deletedAt: overrides?.deletedAt ?? null,
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
    version: overrides?.version ?? 0,
    name: overrides?.name ?? `test-container-${containerCounter}`,
    containerId: overrides?.containerId ?? `docker-container-${containerCounter}`,
    image: overrides?.image ?? "test-image:latest",
    status: overrides?.status ?? "RUNNING",
    containerNumber: overrides?.containerNumber ?? 1,
    config: overrides?.config ?? {},
    env: overrides?.env ?? null,
    healthStatus: overrides?.healthStatus ?? null,
    healthChecks: overrides?.healthChecks ?? 0,
    healthFails: overrides?.healthFails ?? 0,
    lastHealthCheckAt: overrides?.lastHealthCheckAt ?? null,
    replacedById: overrides?.replacedById ?? null,
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
