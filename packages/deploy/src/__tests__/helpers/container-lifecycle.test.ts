import { describe, it, expect, beforeEach, vi } from "vitest";
import { ContainerLifecycle } from "../../helpers/container-lifecycle";
import { createMockLogger } from "../fixtures";
import type { IProxyIntegration } from "@forge/proxy";

/* eslint-disable @typescript-eslint/explicit-function-return-type */
// Test mock factories — return types are intentionally inferred

function createMockDb() {
  const mockTransaction = vi.fn();
  const tx: Record<string, unknown> = {
    container: {
      create: vi.fn().mockResolvedValue({
        id: "db-container-1",
        containerId: "docker-container-1",
      }),
    },
    portMapping: { createMany: vi.fn().mockResolvedValue(undefined) },
    volumeMapping: { createMany: vi.fn().mockResolvedValue(undefined) },
    healthCheckConfig: { create: vi.fn().mockResolvedValue(undefined) },
    networkAttachment: { create: vi.fn().mockResolvedValue(undefined) },
    resourceLimit: { create: vi.fn().mockResolvedValue(undefined) },
  };

  mockTransaction.mockImplementation((fn: (txArg: Record<string, unknown>) => Promise<unknown>) =>
    fn(tx)
  );

  return {
    container: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue(undefined),
      updateMany: vi.fn().mockResolvedValue(undefined),
    },
    $transaction: mockTransaction,
  };
}

function createMockRuntime() {
  return {
    create: vi.fn().mockResolvedValue({ id: "docker-created-1" }),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    waitForHealthy: vi.fn().mockResolvedValue(undefined),
    listNetworks: vi.fn().mockResolvedValue([]),
    createNetwork: vi.fn().mockResolvedValue(undefined),
    listVolumes: vi.fn().mockResolvedValue([]),
    createVolume: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockProxy(): IProxyIntegration {
  return {
    prepareContainer: vi.fn().mockResolvedValue({
      labels: { "traefik.enable": "true" },
      additionalNetworks: [{ name: "traefik-network" }],
    }),
    onContainerDeployed: vi.fn().mockResolvedValue({ urls: ["http://example.com"] }),
    onContainerRemoved: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    generateDeploymentUrl: vi.fn().mockReturnValue("http://test.example.com"),
  };
}

describe("ContainerLifecycle", () => {
  let lifecycle: ContainerLifecycle;
  let db: ReturnType<typeof createMockDb>;
  let runtime: ReturnType<typeof createMockRuntime>;
  let logger: ReturnType<typeof createMockLogger>;
  let proxy: IProxyIntegration;

  const deployment = { id: "deployment-1" };
  const project = {
    id: "project-1",
    name: "Test Project",
    config: {
      runtime: { port: 3000, env: { NODE_ENV: "production" } },
      volumes: [],
      networking: { ports: [] },
      lifecycle: {},
      container: {},
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
    runtime = createMockRuntime();
    logger = createMockLogger();
    proxy = createMockProxy();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    lifecycle = new ContainerLifecycle(db as any, runtime as any, logger, proxy);
  });

  describe("createContainer", () => {
    it("calls ensureNetwork and ensureVolumes before creating container", async () => {
      await lifecycle.createContainer(deployment, project, "nginx:latest");

      expect(runtime.listNetworks).toHaveBeenCalledWith({
        name: [expect.stringContaining("project-1")],
      });
      expect(runtime.create).toHaveBeenCalled();
    });

    it("calls proxyIntegration.prepareContainer and merges labels", async () => {
      await lifecycle.createContainer(deployment, project, "nginx:latest");

      expect(proxy.prepareContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "project-1",
          deploymentId: "deployment-1",
        })
      );

      const createCall = runtime.create.mock.calls[0][0];
      expect(createCall.labels).toHaveProperty("traefik.enable", "true");
      expect(createCall.labels).toHaveProperty("forge.managed", "true");
    });

    it("continues without proxy routing when prepareContainer throws", async () => {
      vi.mocked(proxy.prepareContainer).mockRejectedValue(new Error("Proxy unavailable"));

      await lifecycle.createContainer(deployment, project, "nginx:latest");

      expect(logger.warn).toHaveBeenCalledWith(
        "Proxy prepareContainer failed: container will be created without proxy routing",
        expect.objectContaining({ deploymentId: "deployment-1" })
      );

      const createCall = runtime.create.mock.calls[0][0];
      expect(createCall.labels).toHaveProperty("forge.managed", "true");
      expect(createCall.labels).not.toHaveProperty("traefik.enable");
    });

    it("creates database records within a transaction", async () => {
      await lifecycle.createContainer(deployment, project, "nginx:latest");

      expect(db.$transaction).toHaveBeenCalledTimes(1);
      expect(runtime.create).toHaveBeenCalled();
    });

    it("returns managed container with DB and Docker IDs", async () => {
      const result = await lifecycle.createContainer(deployment, project, "nginx:latest");

      expect(result).toEqual({
        id: "db-container-1",
        containerId: "docker-created-1",
      });
    });
  });

  describe("startContainer", () => {
    it("calls runtime.start and updates DB status", async () => {
      const container = { id: "db-1", containerId: "docker-1" };

      await lifecycle.startContainer(container);

      expect(runtime.start).toHaveBeenCalledWith("docker-1");
      expect(db.container.update).toHaveBeenCalledWith({
        where: { id: "db-1" },
        data: expect.objectContaining({ status: "STARTING" }),
      });
    });
  });

  describe("waitForHealthy", () => {
    it("returns true when runtime reports healthy", async () => {
      runtime.waitForHealthy.mockResolvedValue(undefined);

      const result = await lifecycle.waitForHealthy("docker-1", 60_000);

      expect(result).toBe(true);
      expect(runtime.waitForHealthy).toHaveBeenCalledWith("docker-1", {
        timeout: 60_000,
      });
    });

    it("returns false and logs warning when runtime throws", async () => {
      runtime.waitForHealthy.mockRejectedValue(new Error("timeout"));

      const result = await lifecycle.waitForHealthy("docker-1", 60_000);

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        "Container health check failed",
        expect.objectContaining({ containerId: "docker-1" })
      );
    });
  });

  describe("stopAndRemove", () => {
    it("skips if container is already TERMINATED", async () => {
      db.container.findMany.mockResolvedValue([{ id: "some-id" }]);

      await lifecycle.stopAndRemove("docker-1");

      expect(runtime.stop).not.toHaveBeenCalled();
      expect(runtime.remove).not.toHaveBeenCalled();
      expect(db.container.updateMany).not.toHaveBeenCalled();
    });

    it("stops, removes, and updates DB for non-terminated containers", async () => {
      db.container.findMany.mockResolvedValue([]);

      await lifecycle.stopAndRemove("docker-1");

      expect(runtime.stop).toHaveBeenCalledWith("docker-1", { timeout: 10_000 });
      expect(runtime.remove).toHaveBeenCalledWith("docker-1", { force: true });
      expect(db.container.updateMany).toHaveBeenCalledWith({
        where: { containerId: "docker-1", status: { not: "TERMINATED" } },
        data: { status: "TERMINATED", healthStatus: "UNHEALTHY" },
      });
    });

    it("handles runtime.stop throwing gracefully (already stopped)", async () => {
      db.container.findMany.mockResolvedValue([]);
      runtime.stop.mockRejectedValue(new Error("not running"));

      await lifecycle.stopAndRemove("docker-1");

      expect(runtime.remove).toHaveBeenCalled();
      expect(db.container.updateMany).toHaveBeenCalled();
    });

    it("handles runtime.remove throwing gracefully (already removed)", async () => {
      db.container.findMany.mockResolvedValue([]);
      runtime.remove.mockRejectedValue(new Error("not found"));

      await lifecycle.stopAndRemove("docker-1");

      expect(db.container.updateMany).toHaveBeenCalled();
    });
  });

  describe("stopAndRemoveWithContext", () => {
    it("calls proxyIntegration.onContainerRemoved before stopping", async () => {
      db.container.findMany.mockResolvedValue([]);

      await lifecycle.stopAndRemoveWithContext(
        "docker-1",
        "project-1",
        "deployment-1",
        "Test Project"
      );

      expect(proxy.onContainerRemoved).toHaveBeenCalledWith({
        projectId: "project-1",
        deploymentId: "deployment-1",
        containerId: "docker-1",
        networkName: expect.any(String),
      });
    });

    it("handles proxy failure gracefully and continues with cleanup", async () => {
      db.container.findMany.mockResolvedValue([]);
      vi.mocked(proxy.onContainerRemoved).mockRejectedValue(new Error("Proxy error"));

      await lifecycle.stopAndRemoveWithContext(
        "docker-1",
        "project-1",
        "deployment-1",
        "Test Project"
      );

      expect(logger.warn).toHaveBeenCalledWith(
        "Proxy onContainerRemoved failed during container cleanup",
        expect.objectContaining({ containerId: "docker-1" })
      );
      expect(runtime.stop).toHaveBeenCalled();
    });

    it("skips if container is already TERMINATED", async () => {
      db.container.findMany.mockResolvedValue([{ id: "some-id" }]);

      await lifecycle.stopAndRemoveWithContext(
        "docker-1",
        "project-1",
        "deployment-1",
        "Test Project"
      );

      expect(proxy.onContainerRemoved).not.toHaveBeenCalled();
    });
  });

  describe("forceTerminateByDeployment", () => {
    it("removes all non-terminated containers for a deployment", async () => {
      db.container.findMany
        .mockResolvedValueOnce([
          { id: "db-1", containerId: "docker-1" },
          { id: "db-2", containerId: "docker-2" },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await lifecycle.forceTerminateByDeployment("deployment-1", "project-1", "test-deployment");

      expect(db.container.findMany).toHaveBeenCalledWith({
        where: {
          deploymentId: "deployment-1",
          status: { notIn: ["TERMINATED", "STOPPED"] },
        },
        select: { id: true, containerId: true },
      });
      expect(runtime.stop).toHaveBeenCalledTimes(2);
      expect(runtime.remove).toHaveBeenCalledTimes(2);
    });

    it("returns immediately when no containers found", async () => {
      db.container.findMany.mockResolvedValue([]);

      await lifecycle.forceTerminateByDeployment("deployment-1", "project-1", "test-deployment");

      expect(proxy.onContainerRemoved).not.toHaveBeenCalled();
      expect(runtime.stop).not.toHaveBeenCalled();
    });

    it("continues when one container fails to stop", async () => {
      // findMany is called once for initial lookup, then inside stopAndRemoveWithContext
      // for each container (TERMINATED check). Setup: first call returns containers,
      // subsequent calls return empty (not terminated).
      db.container.findMany
        .mockResolvedValueOnce([
          { id: "db-1", containerId: "docker-1" },
          { id: "db-2", containerId: "docker-2" },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      vi.mocked(proxy.onContainerRemoved)
        .mockRejectedValueOnce(new Error("proxy fail"))
        .mockResolvedValueOnce(undefined);

      await lifecycle.forceTerminateByDeployment("deployment-1", "project-1", "test-deployment");

      expect(proxy.onContainerRemoved).toHaveBeenCalledTimes(2);
    });
  });

  describe("ensureNetwork", () => {
    it("returns existing network name if it already exists", async () => {
      runtime.listNetworks.mockResolvedValue([{ name: "forge-net-project-1" }]);

      const result = await lifecycle.ensureNetwork("project-1", "Test Project");

      expect(result).toContain("project-1");
      expect(runtime.createNetwork).not.toHaveBeenCalled();
    });

    it("creates a new network if none exists", async () => {
      runtime.listNetworks.mockResolvedValue([]);

      const result = await lifecycle.ensureNetwork("project-1", "Test Project");

      expect(result).toContain("project-1");
      expect(runtime.createNetwork).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.stringContaining("project-1"),
          driver: "bridge",
          attachable: true,
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        "Created project network",
        expect.objectContaining({ projectName: "Test Project" })
      );
    });
  });

  describe("ensureVolumes", () => {
    it("skips volumes with hostPath and maps them directly", async () => {
      const volumes = [
        {
          mountPath: "/data",
          hostPath: "/host/data",
          mode: "RW" as const,
        },
      ];

      const result = await lifecycle.ensureVolumes(volumes, "project-1");

      expect(result.get("/data")).toBe("/host/data");
      expect(runtime.listVolumes).not.toHaveBeenCalled();
    });

    it("creates named volumes if they do not exist", async () => {
      const volumes = [{ mountPath: "/app/data", mode: "RW" as const }];

      runtime.listVolumes.mockResolvedValue([]);

      const result = await lifecycle.ensureVolumes(volumes, "project-1");

      expect(result.get("/app/data")).toContain("project-1");
      expect(runtime.listVolumes).toHaveBeenCalledWith({
        name: [expect.stringContaining("project-1")],
      });
      expect(runtime.createVolume).toHaveBeenCalled();
    });

    it("reuses existing named volumes", async () => {
      const volumes = [{ mountPath: "/app/data", mode: "RW" as const }];

      runtime.listVolumes.mockResolvedValue([{ name: "forge-volume-data-project-1" }]);

      const result = await lifecycle.ensureVolumes(volumes, "project-1");

      expect(result.get("/app/data")).toBeDefined();
      expect(runtime.createVolume).not.toHaveBeenCalled();
    });

    it("uses custom volume name when provided", async () => {
      const volumes = [{ mountPath: "/data", volumeName: "my-custom-volume", mode: "RW" as const }];

      runtime.listVolumes.mockResolvedValue([]);

      const result = await lifecycle.ensureVolumes(volumes, "project-1");

      expect(result.get("/data")).toBe("my-custom-volume");
    });
  });
});
