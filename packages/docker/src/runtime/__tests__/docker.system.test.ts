import { describe, it, expect, beforeEach, vi } from "vitest";
import { DockerRuntime } from "../docker";
import {
  HealthCheckTimeoutError,
  DockerRuntimeError,
  ContainerNotRunningError,
} from "../../errors";
import { Readable } from "node:stream";

function createMockRuntime(): DockerRuntime {
  const runtime = new DockerRuntime({ socketPath: "/mock/docker.sock" });
  (runtime as any).docker = {
    getContainer: vi.fn(),
    info: vi.fn(),
    listContainers: vi.fn(),
    getEvents: vi.fn(),
    df: vi.fn(),
  };
  return runtime;
}

// Minimal raw Docker inspect shape that survives mapContainerInfoDetailed
function makeInspectInfo(stateOverrides: any = {}): any {
  return {
    Id: "c-1",
    Name: "/test",
    Config: { Image: "nginx", Hostname: "abc", Env: [], Labels: {} },
    State: {
      Status: "running",
      Running: true,
      Paused: false,
      Restarting: false,
      OOMKilled: false,
      Dead: false,
      Pid: 100,
      ExitCode: 0,
      Error: "",
      StartedAt: "2024-01-01T00:00:00Z",
      FinishedAt: "",
      ...stateOverrides,
    },
    Created: 1704067200000,
    NetworkSettings: { IPAddress: "172.17.0.2", Gateway: "172.17.0.1", Ports: {}, Networks: {} },
    Mounts: [],
  };
}

describe("DockerRuntime system methods", () => {
  let runtime: DockerRuntime;
  let mockDocker: any;

  beforeEach(() => {
    runtime = createMockRuntime();
    mockDocker = (runtime as any).docker;
  });

  describe("healthCheck", () => {
    it("returns healthy: true with version and os when docker.info() succeeds", async () => {
      mockDocker.info.mockResolvedValue({
        ServerVersion: "24.0.7",
        OperatingSystem: "Ubuntu 22.04",
      });

      const result = await runtime.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.version).toBe("24.0.7");
      expect(result.os).toBe("Ubuntu 22.04");
    });

    it("returns healthy: false with error message when docker.info() throws", async () => {
      mockDocker.info.mockRejectedValue(new Error("daemon unavailable"));

      const result = await runtime.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toBe("daemon unavailable");
    });

    it("handles non-Error thrown values", async () => {
      mockDocker.info.mockRejectedValue("string error");

      const result = await runtime.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toBe("Unknown error");
    });
  });

  describe("waitForHealthy", () => {
    beforeEach(() => {
      (runtime as any).sleep = vi.fn().mockResolvedValue(undefined);
    });

    it("resolves immediately when container health is 'healthy'", async () => {
      mockDocker.getContainer.mockReturnValue({
        inspect: vi
          .fn()
          .mockResolvedValue(
            makeInspectInfo({ Health: { Status: "healthy", FailingStreak: 0, Log: [] } })
          ),
      });

      await runtime.waitForHealthy("c-1", { timeout: 5000, interval: 500 });
    });

    it("polls and resolves when health becomes 'healthy'", async () => {
      let callCount = 0;
      mockDocker.getContainer.mockReturnValue({
        inspect: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve(
              makeInspectInfo({ Health: { Status: "starting", FailingStreak: 0, Log: [] } })
            );
          }
          return Promise.resolve(
            makeInspectInfo({ Health: { Status: "healthy", FailingStreak: 0, Log: [] } })
          );
        }),
      });

      await runtime.waitForHealthy("c-1", { timeout: 5000, interval: 500 });
      expect(callCount).toBe(2);
    });

    it("throws HealthCheckTimeoutError when timeout exceeded", async () => {
      mockDocker.getContainer.mockReturnValue({
        inspect: vi
          .fn()
          .mockResolvedValue(
            makeInspectInfo({ Health: { Status: "starting", FailingStreak: 0, Log: [] } })
          ),
      });

      // Use a very short timeout and interval for fast test
      await expect(runtime.waitForHealthy("c-1", { timeout: 100, interval: 10 })).rejects.toThrow(
        HealthCheckTimeoutError
      );
    });

    it("throws DockerRuntimeError when container becomes 'unhealthy'", async () => {
      mockDocker.getContainer.mockReturnValue({
        inspect: vi
          .fn()
          .mockResolvedValue(
            makeInspectInfo({ Health: { Status: "unhealthy", FailingStreak: 3, Log: [] } })
          ),
      });

      await expect(runtime.waitForHealthy("c-1")).rejects.toThrow(DockerRuntimeError);
    });

    it("returns when container is running but has no health check config", async () => {
      // No Health property in State — mapContainerInfoDetailed returns undefined for health
      mockDocker.getContainer.mockReturnValue({
        inspect: vi.fn().mockResolvedValue(makeInspectInfo()),
      });

      await runtime.waitForHealthy("c-1");
    });

    it("respects AbortSignal for early cancellation", async () => {
      const controller = new AbortController();
      controller.abort();

      mockDocker.getContainer.mockReturnValue({
        inspect: vi
          .fn()
          .mockResolvedValue(
            makeInspectInfo({ Health: { Status: "starting", FailingStreak: 0, Log: [] } })
          ),
      });

      await expect(runtime.waitForHealthy("c-1", { signal: controller.signal })).rejects.toThrow(
        "Wait aborted"
      );
    });
  });

  describe("waitForState", () => {
    beforeEach(() => {
      (runtime as any).sleep = vi.fn().mockResolvedValue(undefined);
    });

    it("resolves immediately when container is already in target state", async () => {
      mockDocker.getContainer.mockReturnValue({
        inspect: vi.fn().mockResolvedValue({ State: { Status: "running" } }),
      });

      await runtime.waitForState("c-1", "running");
    });

    it("polls and resolves when container reaches target state", async () => {
      let callCount = 0;
      mockDocker.getContainer.mockReturnValue({
        inspect: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({ State: { Status: "created" } });
          }
          return Promise.resolve({ State: { Status: "running" } });
        }),
      });

      await runtime.waitForState("c-1", "running");
      expect(callCount).toBe(2);
    });

    it("throws WAIT_STATE_TIMEOUT error when timeout exceeded", async () => {
      mockDocker.getContainer.mockReturnValue({
        inspect: vi.fn().mockResolvedValue({ State: { Status: "created" } }),
      });

      await expect(
        runtime.waitForState("c-1", "running", { timeout: 100, interval: 10 })
      ).rejects.toThrow(DockerRuntimeError);
    });

    it("throws ContainerNotRunningError when container goes to dead", async () => {
      mockDocker.getContainer.mockReturnValue({
        inspect: vi.fn().mockResolvedValue({ State: { Status: "dead" } }),
      });

      await expect(runtime.waitForState("c-1", "running")).rejects.toThrow(
        ContainerNotRunningError
      );
    });

    it("throws ContainerNotRunningError when container goes to exited", async () => {
      mockDocker.getContainer.mockReturnValue({
        inspect: vi.fn().mockResolvedValue({ State: { Status: "exited" } }),
      });

      await expect(runtime.waitForState("c-1", "running")).rejects.toThrow(
        ContainerNotRunningError
      );
    });

    it("respects AbortSignal", async () => {
      const controller = new AbortController();
      controller.abort();

      mockDocker.getContainer.mockReturnValue({
        inspect: vi.fn().mockResolvedValue({ State: { Status: "created" } }),
      });

      await expect(
        runtime.waitForState("c-1", "running", { signal: controller.signal })
      ).rejects.toThrow("Wait aborted");
    });
  });

  describe("getSystemInfo", () => {
    it("maps all fields from docker.info()", async () => {
      mockDocker.info.mockResolvedValue({
        ServerVersion: "24.0.7",
        OperatingSystem: "Ubuntu 22.04",
        KernelVersion: "5.15.0",
        Architecture: "x86_64",
        NCPU: 4,
        MemTotal: 8_000_000_000,
        Containers: 10,
        ContainersRunning: 5,
        ContainersPaused: 2,
        ContainersStopped: 3,
        Images: 20,
        Driver: "overlay2",
        Name: "docker-host",
        Labels: ["env=prod"],
        Warnings: [],
      });

      const info = await runtime.getSystemInfo();

      expect(info.ServerVersion).toBe("24.0.7");
      expect(info.OperatingSystem).toBe("Ubuntu 22.04");
      expect(info.KernelVersion).toBe("5.15.0");
      expect(info.Architecture).toBe("x86_64");
      expect(info.NCPU).toBe(4);
      expect(info.MemTotal).toBe(8_000_000_000);
      expect(info.Containers).toBe(10);
      expect(info.ContainersRunning).toBe(5);
      expect(info.ContainersPaused).toBe(2);
      expect(info.ContainersStopped).toBe(3);
      expect(info.Images).toBe(20);
      expect(info.Driver).toBe("overlay2");
      expect(info.Name).toBe("docker-host");
    });
  });

  describe("getAggregatedStats", () => {
    it("returns zeros when no running containers", async () => {
      mockDocker.listContainers.mockResolvedValue([]);
      mockDocker.info.mockResolvedValue({ MemTotal: 8_000_000_000 });

      const stats = await runtime.getAggregatedStats();

      expect(stats.cpuPercent).toBe(0);
      expect(stats.memoryUsedBytes).toBe(0);
      expect(stats.memoryLimitBytes).toBe(8_000_000_000);
    });

    it("aggregates cpu and memory across running containers", async () => {
      mockDocker.listContainers.mockResolvedValue([{ Id: "c-1" }]);

      const mockContainer = {
        stats: vi.fn((_opts: any, cb: any) => {
          cb(null, {
            cpu_stats: {
              cpu_usage: { total_usage: 500000000 },
              system_cpu_usage: 2000000000,
              online_cpus: 4,
            },
            precpu_stats: {
              cpu_usage: { total_usage: 400000000 },
              system_cpu_usage: 1900000000,
            },
            memory_stats: { usage: 100_000_000, limit: 2_000_000_000 },
          });
        }),
      };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const stats = await runtime.getAggregatedStats();

      expect(stats.memoryUsedBytes).toBe(100_000_000);
      expect(stats.memoryLimitBytes).toBe(2_000_000_000);
    });

    it("falls back to MemTotal when all stats calls fail", async () => {
      mockDocker.listContainers.mockResolvedValue([{ Id: "c-1" }]);

      const mockContainer = {
        stats: vi.fn((_opts: any, cb: any) => {
          cb(new Error("failed"));
        }),
      };
      mockDocker.getContainer.mockReturnValue(mockContainer);
      mockDocker.info.mockResolvedValue({ MemTotal: 8_000_000_000 });

      const stats = await runtime.getAggregatedStats();

      expect(stats.cpuPercent).toBe(0);
      expect(stats.memoryUsedBytes).toBe(0);
      expect(stats.memoryLimitBytes).toBe(8_000_000_000);
    });
  });

  describe("getDiskUsage", () => {
    it("returns images, containers, volumes sizes and total", async () => {
      mockDocker.df.mockResolvedValue({
        LayersSize: 5_000_000_000,
        Containers: [{ SizeRw: 1_000_000 }, { SizeRw: 2_000_000 }],
        Volumes: [{ UsageData: { Size: 3_000_000 } }, { UsageData: { Size: 4_000_000 } }],
      });

      const usage = await runtime.getDiskUsage();

      expect(usage.imagesSizeBytes).toBe(5_000_000_000);
      expect(usage.containersSizeBytes).toBe(3_000_000);
      expect(usage.volumesSizeBytes).toBe(7_000_000);
      expect(usage.totalSizeBytes).toBe(5_000_000_000 + 3_000_000 + 7_000_000);
    });

    it("handles missing data with defaults", async () => {
      mockDocker.df.mockResolvedValue({});

      const usage = await runtime.getDiskUsage();

      expect(usage.imagesSizeBytes).toBe(0);
      expect(usage.containersSizeBytes).toBe(0);
      expect(usage.volumesSizeBytes).toBe(0);
      expect(usage.totalSizeBytes).toBe(0);
    });
  });

  describe("stats", () => {
    it("returns mapped stats for single container (non-streaming)", async () => {
      const statsData = {
        cpu_stats: {
          cpu_usage: { total_usage: 500000000 },
          system_cpu_usage: 2000000000,
          online_cpus: 4,
        },
        precpu_stats: {
          cpu_usage: { total_usage: 400000000 },
          system_cpu_usage: 1900000000,
        },
        memory_stats: { usage: 100_000_000, limit: 2_000_000_000 },
        networks: { eth0: { rx_bytes: 1000, tx_bytes: 2000, rx_packets: 10, tx_packets: 20 } },
        blkio_stats: {
          io_service_bytes_recursive: [
            { op: "read", value: 4096 },
            { op: "write", value: 8192 },
          ],
        },
      };

      const mockContainer = {
        stats: vi.fn().mockResolvedValue(statsData),
      };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const result = await runtime.stats("c-1");

      expect(result.cpu.usage).toBeGreaterThan(0);
      expect(result.memory.usage).toBe(100_000_000);
      expect(result.network.rxBytes).toBe(1000);
      expect(result.blockIO.readBytes).toBe(4096);
    });

    it("returns first data event for streaming mode", async () => {
      const statsData = {
        cpu_stats: {
          cpu_usage: { total_usage: 100 },
          system_cpu_usage: 200,
          online_cpus: 2,
        },
        precpu_stats: {
          cpu_usage: { total_usage: 50 },
          system_cpu_usage: 150,
        },
        memory_stats: { usage: 50_000_000, limit: 1_000_000_000 },
        networks: {},
        blkio_stats: {},
      };

      const { Readable } = await import("node:stream");
      const statsStream = Readable.from([Buffer.from(JSON.stringify(statsData))]);
      const mockContainer = { stats: vi.fn().mockResolvedValue(statsStream) };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const result = await runtime.stats("c-1", true);

      expect(result.memory.usage).toBe(50_000_000);
    });
  });

  describe("events", () => {
    it("yields parsed JSON events from the event stream", async () => {
      const event1 = { status: "start", id: "c-1", Type: "container" };
      const event2 = { status: "die", id: "c-2", Type: "container" };

      const mockStream = Readable.from([
        Buffer.from(JSON.stringify(event1) + "\n" + JSON.stringify(event2)),
      ]);
      mockDocker.getEvents.mockResolvedValue(mockStream);

      const events: any[] = [];
      for await (const event of runtime.events()) {
        events.push(event);
      }

      expect(events).toHaveLength(2);
      expect(events[0].status).toBe("start");
      expect(events[1].status).toBe("die");
    });

    it("applies type, event, label, container filters", async () => {
      const mockStream = Readable.from([Buffer.from("")]);
      mockDocker.getEvents.mockResolvedValue(mockStream);

      for await (const _ of runtime.events({
        type: ["container"],
        event: ["start"],
        label: ["app=web"],
        container: ["c-1"],
      })) {
        // drain
      }

      const callArgs = mockDocker.getEvents.mock.calls[0][0] as { filters: string };
      const filters = JSON.parse(callArgs.filters);
      expect(filters.type).toContain("container");
      expect(filters.event).toContain("start");
      expect(filters.label).toContain("app=web");
      expect(filters.container).toContain("c-1");
    });

    it("skips malformed JSON lines silently", async () => {
      const event = { status: "start", id: "c-1", Type: "container" };

      const mockStream = Readable.from([
        Buffer.from("not json\n" + JSON.stringify(event) + "\n{broken\n"),
      ]);
      mockDocker.getEvents.mockResolvedValue(mockStream);

      const events: any[] = [];
      for await (const e of runtime.events()) {
        events.push(e);
      }

      expect(events).toHaveLength(1);
      expect(events[0].status).toBe("start");
    });
  });
});
