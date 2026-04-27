import type {
  Project,
  Deployment,
  DbContainer,
  Service,
  User,
  Team,
  Environment,
  AlertRule,
  AlertChannel,
  Domain,
  Secret,
  CreateProjectRequest,
} from "@forge/types";

let projectCounter = 0;
let deploymentCounter = 0;
let serviceCounter = 0;
let containerCounter = 0;
let userCounter = 0;
let teamCounter = 0;
let environmentCounter = 0;
let alertRuleCounter = 0;
let alertChannelCounter = 0;
let domainCounter = 0;
let secretCounter = 0;

/**
 * Reset all factory counters
 * Call this in beforeEach or afterAll to ensure consistent IDs
 */
export function resetFactories(): void {
  projectCounter = 0;
  deploymentCounter = 0;
  serviceCounter = 0;
  containerCounter = 0;
  userCounter = 0;
  teamCounter = 0;
  environmentCounter = 0;
  alertRuleCounter = 0;
  alertChannelCounter = 0;
  domainCounter = 0;
  secretCounter = 0;
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
    status: overrides?.status ?? "RUNNING",
    config: overrides?.config ?? {},
    connectionHost: overrides?.connectionHost ?? null,
    connectionPort: overrides?.connectionPort ?? null,
    connectionUrl: overrides?.connectionUrl ?? null,
    connectionUsername: overrides?.connectionUsername ?? null,
    connectionPassword: overrides?.connectionPassword ?? null,
    connectionDatabase: overrides?.connectionDatabase ?? null,
    version: overrides?.version ?? null,
    internalHostname: overrides?.internalHostname ?? null,
    volumeName: overrides?.volumeName ?? null,
    containerId: overrides?.containerId ?? null,
    isShared: overrides?.isShared ?? false,
    autoBackupSchedule: overrides?.autoBackupSchedule ?? null,
    autoBackupRetention: overrides?.autoBackupRetention ?? null,
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

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export function createTestUser(
  overrides?: Partial<User>
): Omit<User, "id" | "createdAt" | "updatedAt"> & { id?: string } {
  userCounter++;

  return {
    id: overrides?.id ?? `test-user-${userCounter}`,
    email: overrides?.email ?? `test-user-${userCounter}@example.com`,
    name: overrides?.name ?? `Test User ${userCounter}`,
    avatarUrl: overrides?.avatarUrl ?? null,
    passwordHash: overrides?.passwordHash ?? null,
    status: overrides?.status ?? "ACTIVE",
    lastLoginAt: overrides?.lastLoginAt ?? null,
    loginCount: overrides?.loginCount ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

export function createTestTeam(
  overrides?: Partial<Team>
): Omit<Team, "id" | "createdAt" | "updatedAt"> & { id?: string } {
  teamCounter++;

  return {
    id: overrides?.id ?? `test-team-${teamCounter}`,
    name: overrides?.name ?? `Test Team ${teamCounter}`,
    slug: overrides?.slug ?? `test-team-${teamCounter}`,
  };
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

export function createTestEnvironment(
  overrides?: Partial<Environment>
): Omit<Environment, "id" | "createdAt" | "updatedAt"> & { id?: string } {
  environmentCounter++;

  return {
    id: overrides?.id ?? `test-env-${environmentCounter}`,
    projectId: overrides?.projectId ?? `test-project-${projectCounter}`,
    name: overrides?.name ?? "production",
    slug: overrides?.slug ?? "production",
    isProduction: overrides?.isProduction ?? true,
    isDefault: overrides?.isDefault ?? true,
    autoDeploy: overrides?.autoDeploy ?? false,
    branch: overrides?.branch ?? null,
    domain: overrides?.domain ?? null,
    subdomain: overrides?.subdomain ?? null,
  };
}

// ---------------------------------------------------------------------------
// AlertRule
// ---------------------------------------------------------------------------

export function createTestAlertRule(
  overrides?: Partial<AlertRule>
): Omit<AlertRule, "id" | "createdAt" | "updatedAt"> & { id?: string } {
  alertRuleCounter++;

  return {
    id: overrides?.id ?? `test-alert-rule-${alertRuleCounter}`,
    projectId: overrides?.projectId ?? `test-project-${projectCounter}`,
    name: overrides?.name ?? `Test Alert Rule ${alertRuleCounter}`,
    description: overrides?.description ?? null,
    metric: overrides?.metric ?? "cpu_usage",
    operator: overrides?.operator ?? "GREATER_THAN",
    threshold: overrides?.threshold ?? 80,
    duration: overrides?.duration ?? 300,
    severity: overrides?.severity ?? "WARNING",
    sourceType: overrides?.sourceType ?? null,
    sourceId: overrides?.sourceId ?? null,
    enabled: overrides?.enabled ?? true,
    createdBy: overrides?.createdBy ?? null,
  };
}

// ---------------------------------------------------------------------------
// AlertChannel
// ---------------------------------------------------------------------------

export function createTestAlertChannel(
  overrides?: Partial<AlertChannel>
): Omit<AlertChannel, "id" | "createdAt" | "updatedAt"> & { id?: string } {
  alertChannelCounter++;

  return {
    id: overrides?.id ?? `test-alert-channel-${alertChannelCounter}`,
    projectId: overrides?.projectId ?? null,
    name: overrides?.name ?? `Test Alert Channel ${alertChannelCounter}`,
    type: overrides?.type ?? "WEBHOOK",
    config: overrides?.config ?? { url: "https://example.com/webhook" },
    enabled: overrides?.enabled ?? true,
  };
}

// ---------------------------------------------------------------------------
// Domain
// ---------------------------------------------------------------------------

export function createTestDomain(
  overrides?: Partial<Domain>
): Omit<Domain, "id" | "createdAt" | "updatedAt"> & { id?: string } {
  domainCounter++;

  return {
    id: overrides?.id ?? `test-domain-${domainCounter}`,
    projectId: overrides?.projectId ?? `test-project-${projectCounter}`,
    domain: overrides?.domain ?? `test-${domainCounter}.example.com`,
    verified: overrides?.verified ?? false,
    verificationToken: overrides?.verificationToken ?? null,
    isPrimary: overrides?.isPrimary ?? false,
    sslStatus: overrides?.sslStatus ?? "PENDING",
    sslIssuedAt: overrides?.sslIssuedAt ?? null,
    sslExpiresAt: overrides?.sslExpiresAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// Secret
// ---------------------------------------------------------------------------

export function createTestSecret(
  overrides?: Partial<Secret>
): Omit<Secret, "id" | "createdAt" | "updatedAt"> & { id?: string } {
  secretCounter++;

  return {
    id: overrides?.id ?? `test-secret-${secretCounter}`,
    projectId: overrides?.projectId ?? null,
    key: overrides?.key ?? `TEST_SECRET_${secretCounter}`,
    encryptedValue: overrides?.encryptedValue ?? "encrypted-test-value",
    encryptionKeyId: overrides?.encryptionKeyId ?? `test-key-${secretCounter}`,
    description: overrides?.description ?? null,
    createdBy: overrides?.createdBy ?? null,
    updatedBy: overrides?.updatedBy ?? null,
    lastAccessedAt: overrides?.lastAccessedAt ?? null,
    accessCount: overrides?.accessCount ?? 0,
    deletedAt: overrides?.deletedAt ?? null,
  };
}
