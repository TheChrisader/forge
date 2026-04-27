import { describe, it, expect, beforeEach, vi } from "vitest";
import { DockerRuntime } from "../docker";

function createMockRuntime(): DockerRuntime {
  const runtime = new DockerRuntime({ socketPath: "/mock/docker.sock" });
  (runtime as any).docker = {
    getContainer: vi.fn(),
    createContainer: vi.fn(),
    listContainers: vi.fn(),
    getImage: vi.fn(),
    modem: { demuxStream: vi.fn(), followProgress: vi.fn() },
  };
  return runtime;
}

describe("DockerRuntime container lifecycle", () => {
  let runtime: DockerRuntime;
  let mockDocker: any;

  beforeEach(() => {
    runtime = createMockRuntime();
    mockDocker = (runtime as any).docker;
  });

  describe("start", () => {
    it("calls container.start() with the container id", async () => {
      const mockContainer = { start: vi.fn().mockResolvedValue(undefined) };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      await runtime.start("container-123");

      expect(mockDocker.getContainer).toHaveBeenCalledWith("container-123");
      expect(mockContainer.start).toHaveBeenCalled();
    });
  });

  describe("stop", () => {
    it("calls container.stop() with timeout option", async () => {
      const mockContainer = { stop: vi.fn().mockResolvedValue(undefined) };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      await runtime.stop("container-123", { timeout: 10 });

      expect(mockContainer.stop).toHaveBeenCalledWith({ t: 10 });
    });

    it("calls without timeout when options undefined", async () => {
      const mockContainer = { stop: vi.fn().mockResolvedValue(undefined) };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      await runtime.stop("container-123");

      expect(mockContainer.stop).toHaveBeenCalledWith({ t: undefined });
    });
  });

  describe("restart", () => {
    it("calls container.restart()", async () => {
      const mockContainer = { restart: vi.fn().mockResolvedValue(undefined) };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      await runtime.restart("container-123");

      expect(mockContainer.restart).toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("calls container.remove() with force and volumes options", async () => {
      const mockContainer = { remove: vi.fn().mockResolvedValue(undefined) };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      await runtime.remove("container-123", { force: true, volumes: true });

      expect(mockContainer.remove).toHaveBeenCalledWith({ force: true, v: true });
    });

    it("defaults to no force and no volume removal", async () => {
      const mockContainer = { remove: vi.fn().mockResolvedValue(undefined) };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      await runtime.remove("container-123");

      expect(mockContainer.remove).toHaveBeenCalledWith({ force: undefined, v: undefined });
    });
  });

  describe("rename", () => {
    it("calls container.rename() with new name", async () => {
      const mockContainer = { rename: vi.fn().mockResolvedValue(undefined) };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      await runtime.rename("container-123", "new-name");

      expect(mockContainer.rename).toHaveBeenCalledWith({ name: "new-name" });
    });
  });

  describe("inspect", () => {
    it("returns detailed container info", async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          Id: "c-123",
          Name: "/my-app",
          Config: { Image: "nginx:latest", Hostname: "abc", Env: [], Labels: {} },
          State: {
            Status: "running",
            Running: true,
            Paused: false,
            Restarting: false,
            OOMKilled: false,
            Dead: false,
            Pid: 100,
            ExitCode: 0,
          },
          Created: 1704067200000,
          NetworkSettings: {
            IPAddress: "172.17.0.2",
            Gateway: "172.17.0.1",
            Ports: {},
            Networks: {},
          },
          Mounts: [],
        }),
      };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const result = await runtime.inspect("c-123");

      expect(mockDocker.getContainer).toHaveBeenCalledWith("c-123");
      expect(result.id).toBe("c-123");
      expect(result.name).toBe("my-app");
      expect(result.status).toBe("running");
      expect(result.config).toBeDefined();
      expect(result.networkSettings).toBeDefined();
      expect(result.mounts).toEqual([]);
    });
  });

  describe("list", () => {
    it("lists all containers with all: true", async () => {
      mockDocker.listContainers.mockResolvedValue([
        {
          Id: "c-1",
          Names: ["/app-1"],
          Image: "nginx:latest",
          State: "running",
          Created: 1704067200,
          Labels: { app: "web" },
        },
        {
          Id: "c-2",
          Names: ["/app-2"],
          Image: "redis:7",
          State: "exited",
          Created: 1704067200,
          Labels: {},
        },
      ]);

      const containers = await runtime.list();

      expect(mockDocker.listContainers).toHaveBeenCalledWith(
        expect.objectContaining({ all: true })
      );
      expect(containers).toHaveLength(2);
      expect(containers[0].id).toBe("c-1");
      expect(containers[0].name).toBe("app-1");
      expect(containers[0].status).toBe("running");
      expect(containers[1].status).toBe("exited");
    });

    it("applies id filters", async () => {
      mockDocker.listContainers.mockResolvedValue([]);
      await runtime.list({ id: ["c-1"] });

      expect(mockDocker.listContainers).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.stringContaining("c-1"),
        })
      );
    });

    it("applies name filters", async () => {
      mockDocker.listContainers.mockResolvedValue([]);
      await runtime.list({ name: ["my-app"] });

      expect(mockDocker.listContainers).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.stringContaining("my-app"),
        })
      );
    });

    it("applies status filters", async () => {
      mockDocker.listContainers.mockResolvedValue([]);
      await runtime.list({ status: ["running"] });

      expect(mockDocker.listContainers).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.stringContaining("running"),
        })
      );
    });

    it("applies label filters (converts to key=value strings)", async () => {
      mockDocker.listContainers.mockResolvedValue([]);
      await runtime.list({ label: { app: "web", tier: "frontend" } });

      const callArgs = mockDocker.listContainers.mock.calls[0][0] as { filters: string };
      const filters = JSON.parse(callArgs.filters);
      expect(filters.label).toContain("app=web");
      expect(filters.label).toContain("tier=frontend");
    });

    it("returns empty array when no containers", async () => {
      mockDocker.listContainers.mockResolvedValue([]);
      const containers = await runtime.list();
      expect(containers).toEqual([]);
    });

    it("strips leading slash from container name", async () => {
      mockDocker.listContainers.mockResolvedValue([
        {
          Id: "c-1",
          Names: ["/my-app"],
          Image: "nginx",
          State: "running",
          Created: 1704067200,
          Labels: {},
        },
      ]);

      const containers = await runtime.list();
      expect(containers[0].name).toBe("my-app");
    });
  });

  describe("create", () => {
    beforeEach(() => {
      // Make ensureImage succeed without pulling
      mockDocker.getImage.mockReturnValue({
        inspect: vi.fn().mockResolvedValue({ Id: "sha256:abc" }),
      });
    });

    it("calls createContainer with correct options", async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          Id: "new-container",
          Name: "/test-app",
          Config: { Image: "nginx:latest", Labels: {} },
          State: {
            Status: "created",
            Running: false,
            Paused: false,
            Restarting: false,
            OOMKilled: false,
            Dead: false,
            Pid: 0,
            ExitCode: 0,
          },
          Created: 1704067200000,
        }),
      };
      mockDocker.createContainer.mockResolvedValue(mockContainer);

      await runtime.create({
        name: "test-app",
        image: "nginx:latest",
        cmd: ["node", "server.js"],
        env: { NODE_ENV: "production", PORT: "3000" },
        labels: { app: "web" },
      });

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "test-app",
          Image: "nginx:latest",
          Cmd: ["node", "server.js"],
          Env: expect.arrayContaining(["NODE_ENV=production", "PORT=3000"]),
          Labels: { app: "web" },
        })
      );
    });

    it("resolves networks from config.networks (modern API)", async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          Id: "c-1",
          Name: "/app",
          Config: { Image: "nginx", Labels: {} },
          State: {
            Status: "created",
            Running: false,
            Paused: false,
            Restarting: false,
            OOMKilled: false,
            Dead: false,
            Pid: 0,
            ExitCode: 0,
          },
          Created: 1704067200000,
        }),
      };
      mockDocker.createContainer.mockResolvedValue(mockContainer);

      await runtime.create({
        image: "nginx:latest",
        networks: [{ name: "frontend", aliases: ["web", "app"] }, { name: "backend" }],
      });

      const callArgs = mockDocker.createContainer.mock.calls[0][0];
      expect(callArgs.HostConfig.NetworkMode).toBe("frontend");
      expect(callArgs.NetworkingConfig.EndpointsConfig.frontend).toEqual({
        Aliases: ["web", "app"],
      });
      expect(callArgs.NetworkingConfig.EndpointsConfig.backend).toEqual({
        Aliases: undefined,
      });
    });

    it("falls back to legacy config.network + config.networkAliases", async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          Id: "c-1",
          Name: "/app",
          Config: { Image: "nginx", Labels: {} },
          State: {
            Status: "created",
            Running: false,
            Paused: false,
            Restarting: false,
            OOMKilled: false,
            Dead: false,
            Pid: 0,
            ExitCode: 0,
          },
          Created: 1704067200000,
        }),
      };
      mockDocker.createContainer.mockResolvedValue(mockContainer);

      await runtime.create({
        image: "nginx:latest",
        network: "my-network",
        networkAliases: ["web"],
      });

      const callArgs = mockDocker.createContainer.mock.calls[0][0];
      expect(callArgs.HostConfig.NetworkMode).toBe("my-network");
      expect(callArgs.NetworkingConfig.EndpointsConfig["my-network"].Aliases).toEqual(["web"]);
    });

    it("sets ExposedPorts from config.ports", async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          Id: "c-1",
          Name: "/app",
          Config: { Image: "nginx", Labels: {} },
          State: {
            Status: "created",
            Running: false,
            Paused: false,
            Restarting: false,
            OOMKilled: false,
            Dead: false,
            Pid: 0,
            ExitCode: 0,
          },
          Created: 1704067200000,
        }),
      };
      mockDocker.createContainer.mockResolvedValue(mockContainer);

      await runtime.create({
        image: "nginx:latest",
        ports: [{ containerPort: 80 }, { containerPort: 443, protocol: "tcp" }],
      });

      const callArgs = mockDocker.createContainer.mock.calls[0][0];
      expect(callArgs.ExposedPorts).toEqual({ "80/tcp": {}, "443/tcp": {} });
    });

    it("sets PortBindings from config.ports", async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          Id: "c-1",
          Name: "/app",
          Config: { Image: "nginx", Labels: {} },
          State: {
            Status: "created",
            Running: false,
            Paused: false,
            Restarting: false,
            OOMKilled: false,
            Dead: false,
            Pid: 0,
            ExitCode: 0,
          },
          Created: 1704067200000,
        }),
      };
      mockDocker.createContainer.mockResolvedValue(mockContainer);

      await runtime.create({
        image: "nginx:latest",
        ports: [{ containerPort: 80, hostPort: 8080 }],
      });

      const callArgs = mockDocker.createContainer.mock.calls[0][0];
      expect(callArgs.HostConfig.PortBindings["80/tcp"][0].HostPort).toBe("8080");
    });

    it("sets Binds from config.volumes", async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          Id: "c-1",
          Name: "/app",
          Config: { Image: "nginx", Labels: {} },
          State: {
            Status: "created",
            Running: false,
            Paused: false,
            Restarting: false,
            OOMKilled: false,
            Dead: false,
            Pid: 0,
            ExitCode: 0,
          },
          Created: 1704067200000,
        }),
      };
      mockDocker.createContainer.mockResolvedValue(mockContainer);

      await runtime.create({
        image: "nginx:latest",
        volumes: [
          { source: "/host/data", target: "/data" },
          { source: "/host/config", target: "/config", readOnly: true },
        ],
      });

      const callArgs = mockDocker.createContainer.mock.calls[0][0];
      expect(callArgs.HostConfig.Binds).toContain("/host/data:/data");
      expect(callArgs.HostConfig.Binds).toContain("/host/config:/config:ro");
    });

    it("sets Memory from config.resources.memory via parseMemory", async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          Id: "c-1",
          Name: "/app",
          Config: { Image: "nginx", Labels: {} },
          State: {
            Status: "created",
            Running: false,
            Paused: false,
            Restarting: false,
            OOMKilled: false,
            Dead: false,
            Pid: 0,
            ExitCode: 0,
          },
          Created: 1704067200000,
        }),
      };
      mockDocker.createContainer.mockResolvedValue(mockContainer);

      await runtime.create({
        image: "nginx:latest",
        resources: { memory: "512m" },
      });

      const callArgs = mockDocker.createContainer.mock.calls[0][0];
      expect(callArgs.HostConfig.Memory).toBe(512 * 1024 * 1024);
    });

    it("sets NanoCpus from config.resources.cpus", async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          Id: "c-1",
          Name: "/app",
          Config: { Image: "nginx", Labels: {} },
          State: {
            Status: "created",
            Running: false,
            Paused: false,
            Restarting: false,
            OOMKilled: false,
            Dead: false,
            Pid: 0,
            ExitCode: 0,
          },
          Created: 1704067200000,
        }),
      };
      mockDocker.createContainer.mockResolvedValue(mockContainer);

      await runtime.create({
        image: "nginx:latest",
        resources: { cpus: 2 },
      });

      const callArgs = mockDocker.createContainer.mock.calls[0][0];
      expect(callArgs.HostConfig.NanoCpus).toBe(2 * 1e9);
    });

    it("sets RestartPolicy from config.restartPolicy", async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          Id: "c-1",
          Name: "/app",
          Config: { Image: "nginx", Labels: {} },
          State: {
            Status: "created",
            Running: false,
            Paused: false,
            Restarting: false,
            OOMKilled: false,
            Dead: false,
            Pid: 0,
            ExitCode: 0,
          },
          Created: 1704067200000,
        }),
      };
      mockDocker.createContainer.mockResolvedValue(mockContainer);

      await runtime.create({
        image: "nginx:latest",
        restartPolicy: { name: "always", maximumRetryCount: 5 },
      });

      const callArgs = mockDocker.createContainer.mock.calls[0][0];
      expect(callArgs.HostConfig.RestartPolicy).toEqual({ Name: "always", MaximumRetryCount: 5 });
    });

    it("sets Healthcheck from config.healthCheck", async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          Id: "c-1",
          Name: "/app",
          Config: { Image: "nginx", Labels: {} },
          State: {
            Status: "created",
            Running: false,
            Paused: false,
            Restarting: false,
            OOMKilled: false,
            Dead: false,
            Pid: 0,
            ExitCode: 0,
          },
          Created: 1704067200000,
        }),
      };
      mockDocker.createContainer.mockResolvedValue(mockContainer);

      await runtime.create({
        image: "nginx:latest",
        healthCheck: {
          test: ["CMD", "curl", "-f", "http://localhost"],
          interval: "10s",
          timeout: "5s",
          retries: 3,
          startPeriod: "30s",
        },
      });

      const callArgs = mockDocker.createContainer.mock.calls[0][0];
      expect(callArgs.Healthcheck.Test).toEqual(["CMD", "curl", "-f", "http://localhost"]);
      expect(callArgs.Healthcheck.Retries).toBe(3);
    });

    it("sets default ExtraHost host.docker.internal:host-gateway", async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          Id: "c-1",
          Name: "/app",
          Config: { Image: "nginx", Labels: {} },
          State: {
            Status: "created",
            Running: false,
            Paused: false,
            Restarting: false,
            OOMKilled: false,
            Dead: false,
            Pid: 0,
            ExitCode: 0,
          },
          Created: 1704067200000,
        }),
      };
      mockDocker.createContainer.mockResolvedValue(mockContainer);

      await runtime.create({ image: "nginx:latest" });

      const callArgs = mockDocker.createContainer.mock.calls[0][0];
      expect(callArgs.HostConfig.ExtraHosts).toContain("host.docker.internal:host-gateway");
    });

    it("uses custom extraHosts when provided", async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          Id: "c-1",
          Name: "/app",
          Config: { Image: "nginx", Labels: {} },
          State: {
            Status: "created",
            Running: false,
            Paused: false,
            Restarting: false,
            OOMKilled: false,
            Dead: false,
            Pid: 0,
            ExitCode: 0,
          },
          Created: 1704067200000,
        }),
      };
      mockDocker.createContainer.mockResolvedValue(mockContainer);

      await runtime.create({
        image: "nginx:latest",
        extraHosts: ["custom.host:192.168.1.1"],
      });

      const callArgs = mockDocker.createContainer.mock.calls[0][0];
      expect(callArgs.HostConfig.ExtraHosts).toEqual(["custom.host:192.168.1.1"]);
    });

    it("returns mapped Container info", async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          Id: "new-id",
          Name: "/new-app",
          Config: { Image: "nginx:latest", Labels: { app: "web" } },
          State: {
            Status: "running",
            Running: true,
            Paused: false,
            Restarting: false,
            OOMKilled: false,
            Dead: false,
            Pid: 100,
            ExitCode: 0,
            StartedAt: "2024-01-01T00:00:00Z",
            FinishedAt: "",
          },
          Created: 1704067200000,
        }),
      };
      mockDocker.createContainer.mockResolvedValue(mockContainer);

      const result = await runtime.create({ image: "nginx:latest" });

      expect(result.id).toBe("new-id");
      expect(result.name).toBe("new-app");
      expect(result.image).toBe("nginx:latest");
      expect(result.status).toBe("running");
    });
  });
});
