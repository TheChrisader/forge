import { vi } from "vitest";
import type { ILogger } from "@forge/core";
import type { DeploymentContext } from "../interfaces/strategy";
import type { IContainerLifecycle, ManagedContainer } from "../helpers/container-lifecycle";

let containerCounter = 0;
let lifecycleCounter = 0;

export function createMockLogger(): ILogger {
  return {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
    getLevel: vi.fn().mockReturnValue("info" as const),
    setLevel: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
  };
}

export function createMockManagedContainer(
  overrides?: Partial<ManagedContainer>
): ManagedContainer {
  containerCounter++;
  return {
    id: `db-container-${containerCounter}`,
    containerId: `docker-container-${containerCounter}`,
    ...overrides,
  };
}

export function createMockLifecycle(): IContainerLifecycle {
  return {
    createContainer: vi
      .fn()
      .mockImplementation(
        (_deployment: unknown, _project: unknown, _image: unknown, containerNumber?: number) =>
          Promise.resolve(
            createMockManagedContainer({ containerId: `docker-${containerNumber ?? 1}` })
          )
      ),
    startContainer: vi.fn().mockResolvedValue(undefined),
    waitForHealthy: vi.fn().mockResolvedValue(true),
    stopAndRemove: vi.fn().mockResolvedValue(undefined),
    stopAndRemoveWithContext: vi.fn().mockResolvedValue(undefined),
    ensureNetwork: vi.fn().mockResolvedValue("forge-net-test-project-id"),
    forceTerminateByDeployment: vi.fn().mockResolvedValue(undefined),
    ensureVolumes: vi.fn().mockResolvedValue(new Map()),
  };
}

export function createMockContext(overrides?: Partial<DeploymentContext>): DeploymentContext {
  lifecycleCounter++;
  return {
    deploymentId: `deployment-${lifecycleCounter}`,
    projectId: "project-1",
    projectName: "test-project",
    projectSlug: "test-project",
    image: "nginx:latest",
    replicas: 2,
    env: { NODE_ENV: "production" },
    ports: [{ containerPort: 3000, protocol: "tcp" }],
    volumes: [],
    labels: { "forge.managed": "true" },
    networkName: "forge-net-project-1",
    domains: ["test-project.example.com"],
    targetPort: 3000,
    existingContainerIds: [],
    ...overrides,
  };
}

export function resetFixtureCounters(): void {
  containerCounter = 0;
  lifecycleCounter = 0;
}
