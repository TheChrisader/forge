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

describe("DockerRuntime private helpers", () => {
  let runtime: DockerRuntime;
  let helpers: any;

  beforeEach(() => {
    runtime = createMockRuntime();
    helpers = runtime as any;
  });

  describe("parseMemory", () => {
    it("parses bytes", () => {
      expect(helpers.parseMemory("512b")).toBe(512);
    });

    it("parses kilobytes", () => {
      expect(helpers.parseMemory("512k")).toBe(512 * 1024);
    });

    it("parses megabytes", () => {
      expect(helpers.parseMemory("512m")).toBe(512 * 1024 * 1024);
    });

    it("parses gigabytes", () => {
      expect(helpers.parseMemory("2g")).toBe(2 * 1024 * 1024 * 1024);
    });

    it("parses with uppercase unit", () => {
      expect(helpers.parseMemory("1G")).toBe(1 * 1024 * 1024 * 1024);
    });

    it("parses decimal value", () => {
      expect(helpers.parseMemory("1.5g")).toBe(1.5 * 1024 * 1024 * 1024);
    });

    it("parses bare number as bytes", () => {
      expect(helpers.parseMemory("1024")).toBe(1024);
    });

    it("returns 0 for invalid input", () => {
      expect(helpers.parseMemory("abc")).toBe(0);
    });

    it("returns 0 for empty string", () => {
      expect(helpers.parseMemory("")).toBe(0);
    });

    it("returns 0 for '0b'", () => {
      expect(helpers.parseMemory("0b")).toBe(0);
    });
  });

  describe("parseTime", () => {
    it("parses seconds", () => {
      expect(helpers.parseTime("30s")).toBe(30_000_000_000);
    });

    it("parses minutes", () => {
      expect(helpers.parseTime("2m")).toBe(120_000_000_000);
    });

    it("parses hours", () => {
      expect(helpers.parseTime("1h")).toBe(3600_000_000_000);
    });

    it("defaults to seconds for bare number", () => {
      expect(helpers.parseTime("30")).toBe(30_000_000_000);
    });

    it("returns undefined for empty string", () => {
      expect(helpers.parseTime("")).toBeUndefined();
    });

    it("returns undefined for undefined input", () => {
      expect(helpers.parseTime(undefined)).toBeUndefined();
    });

    it("returns undefined for invalid format", () => {
      expect(helpers.parseTime("abc")).toBeUndefined();
    });

    it("returns undefined for unrecognized unit", () => {
      expect(helpers.parseTime("30x")).toBeUndefined();
    });
  });

  describe("buildExposedPorts", () => {
    it("returns undefined for undefined ports", () => {
      expect(helpers.buildExposedPorts(undefined)).toBeUndefined();
    });

    it("returns undefined for empty array", () => {
      expect(helpers.buildExposedPorts([])).toBeUndefined();
    });

    it("builds single TCP port", () => {
      const result = helpers.buildExposedPorts([{ containerPort: 80 }]);
      expect(result).toEqual({ "80/tcp": {} });
    });

    it("defaults protocol to tcp", () => {
      const result = helpers.buildExposedPorts([{ containerPort: 53 }]);
      expect(result).toEqual({ "53/tcp": {} });
    });

    it("builds single UDP port", () => {
      const result = helpers.buildExposedPorts([{ containerPort: 53, protocol: "udp" }]);
      expect(result).toEqual({ "53/udp": {} });
    });

    it("builds multiple ports", () => {
      const result = helpers.buildExposedPorts([
        { containerPort: 80 },
        { containerPort: 443 },
        { containerPort: 53, protocol: "udp" },
      ]);
      expect(result).toEqual({ "80/tcp": {}, "443/tcp": {}, "53/udp": {} });
    });
  });

  describe("buildPortBindings", () => {
    it("returns undefined for undefined ports", () => {
      expect(helpers.buildPortBindings(undefined)).toBeUndefined();
    });

    it("returns undefined for empty array", () => {
      expect(helpers.buildPortBindings([])).toBeUndefined();
    });

    it("builds binding with hostPort", () => {
      const result = helpers.buildPortBindings([{ containerPort: 80, hostPort: 8080 }]);
      expect(result).toEqual({ "80/tcp": [{ HostPort: "8080", HostIp: "0.0.0.0" }] });
    });

    it("defaults hostIp to '0.0.0.0'", () => {
      const result = helpers.buildPortBindings([{ containerPort: 80 }]);
      expect(result["80/tcp"][0].HostIp).toBe("0.0.0.0");
    });

    it("defaults hostPort to empty string", () => {
      const result = helpers.buildPortBindings([{ containerPort: 80 }]);
      expect(result["80/tcp"][0].HostPort).toBe("");
    });

    it("handles custom hostIp", () => {
      const result = helpers.buildPortBindings([{ containerPort: 80, hostIp: "127.0.0.1" }]);
      expect(result["80/tcp"][0].HostIp).toBe("127.0.0.1");
    });

    it("handles custom protocol", () => {
      const result = helpers.buildPortBindings([
        { containerPort: 53, protocol: "udp", hostPort: 5300 },
      ]);
      expect(result).toEqual({ "53/udp": [{ HostPort: "5300", HostIp: "0.0.0.0" }] });
    });

    it("builds bindings for multiple ports", () => {
      const result = helpers.buildPortBindings([
        { containerPort: 80, hostPort: 8080 },
        { containerPort: 443, hostPort: 8443 },
      ]);
      expect(Object.keys(result as Record<string, unknown>)).toHaveLength(2);
    });
  });

  describe("mapStatus", () => {
    it("maps 'created' to 'created'", () => {
      expect(helpers.mapStatus("created")).toBe("created");
    });

    it("maps 'running' to 'running'", () => {
      expect(helpers.mapStatus("running")).toBe("running");
    });

    it("maps 'paused' to 'paused'", () => {
      expect(helpers.mapStatus("paused")).toBe("paused");
    });

    it("maps 'restarting' to 'restarting'", () => {
      expect(helpers.mapStatus("restarting")).toBe("restarting");
    });

    it("maps 'removing' to 'removing'", () => {
      expect(helpers.mapStatus("removing")).toBe("removing");
    });

    it("maps 'exited' to 'exited'", () => {
      expect(helpers.mapStatus("exited")).toBe("exited");
    });

    it("maps 'dead' to 'dead'", () => {
      expect(helpers.mapStatus("dead")).toBe("dead");
    });

    it("maps unknown status to 'exited' (default)", () => {
      expect(helpers.mapStatus("unknown_state")).toBe("exited");
    });
  });

  describe("mapContainerInfo", () => {
    function makeInspectInfo(overrides: any = {}): any {
      return {
        Id: "container-abc",
        Name: "/my-container",
        Config: {
          Image: "nginx:latest",
          Labels: { app: "web" },
        },
        State: {
          Status: "running",
          Running: true,
          Paused: false,
          Restarting: false,
          OOMKilled: false,
          Dead: false,
          Pid: 1234,
          ExitCode: 0,
          StartedAt: "2024-01-01T00:00:00Z",
          FinishedAt: "2024-01-01T01:00:00Z",
        },
        Created: 1704067200000,
        ...overrides,
      };
    }

    it("maps basic fields", () => {
      const info = makeInspectInfo();
      const result = helpers.mapContainerInfo(info);

      expect(result.id).toBe("container-abc");
      expect(result.name).toBe("my-container");
      expect(result.image).toBe("nginx:latest");
      expect(result.status).toBe("running");
    });

    it("strips leading slash from container name", () => {
      const info = makeInspectInfo({ Name: "/my-container" });
      expect(helpers.mapContainerInfo(info).name).toBe("my-container");
    });

    it("maps state fields", () => {
      const info = makeInspectInfo();
      const result = helpers.mapContainerInfo(info);

      expect(result.state.running).toBe(true);
      expect(result.state.paused).toBe(false);
      expect(result.state.restarting).toBe(false);
      expect(result.state.oomKilled).toBe(false);
      expect(result.state.dead).toBe(false);
      expect(result.state.pid).toBe(1234);
      expect(result.state.exitCode).toBe(0);
    });

    it("maps created timestamp to Date", () => {
      const info = makeInspectInfo({ Created: 1704067200000 });
      const result = helpers.mapContainerInfo(info);
      expect(result.created).toBeInstanceOf(Date);
      expect(result.created.getTime()).toBe(1704067200000);
    });

    it("maps labels", () => {
      const info = makeInspectInfo();
      expect(helpers.mapContainerInfo(info).labels).toEqual({ app: "web" });
    });
  });

  describe("mapContainerInfoDetailed", () => {
    function makeDetailedInfo(overrides: any = {}): any {
      return {
        Id: "container-abc",
        Name: "/my-container",
        Config: {
          Image: "nginx:latest",
          Hostname: "abc123",
          Env: ["NODE_ENV=production", "PORT=3000"],
          Cmd: ["node", "server.js"],
          Labels: { app: "web" },
          WorkingDir: "/app",
        },
        State: {
          Status: "running",
          Running: true,
          Paused: false,
          Restarting: false,
          OOMKilled: false,
          Dead: false,
          Pid: 1234,
          ExitCode: 0,
          Error: "",
          StartedAt: "2024-01-01T00:00:00Z",
          FinishedAt: "2024-01-01T01:00:00Z",
          Health: {
            Status: "healthy",
            FailingStreak: 0,
            Log: [
              { Start: 1704067200000000000, End: 1704067201000000000, ExitCode: 0, Output: "ok" },
            ],
          },
        },
        Created: 1704067200000,
        NetworkSettings: {
          IPAddress: "172.17.0.2",
          Gateway: "172.17.0.1",
          Ports: {
            "80/tcp": [{ HostIp: "0.0.0.0", HostPort: "8080" }],
          },
          Networks: {
            bridge: {
              IPAddress: "172.17.0.2",
              Gateway: "172.17.0.1",
              NetworkID: "net-123",
              EndpointID: "ep-456",
              MacAddress: "02:42:ac:11:00:02",
            },
          },
        },
        Mounts: [
          { Type: "volume", Source: "vol-data", Destination: "/data", Mode: "rw", RW: true },
          {
            Type: "bind",
            Source: "/host/path",
            Destination: "/container/path",
            Mode: "ro",
            RW: false,
          },
        ],
        ...overrides,
      };
    }

    it("maps basic fields", () => {
      const info = makeDetailedInfo();
      const result = helpers.mapContainerInfoDetailed(info);

      expect(result.id).toBe("container-abc");
      expect(result.name).toBe("my-container");
      expect(result.image).toBe("nginx:latest");
    });

    it("maps port bindings", () => {
      const result = helpers.mapContainerInfoDetailed(makeDetailedInfo());
      expect(result.networkSettings.ports["80/tcp"]).toEqual([
        { hostIp: "0.0.0.0", hostPort: "8080" },
      ]);
    });

    it("maps network endpoints", () => {
      const result = helpers.mapContainerInfoDetailed(makeDetailedInfo());
      const bridge = result.networkSettings.networks.bridge;
      expect(bridge.ipAddress).toBe("172.17.0.2");
      expect(bridge.gateway).toBe("172.17.0.1");
      expect(bridge.networkId).toBe("net-123");
      expect(bridge.endpointId).toBe("ep-456");
      expect(bridge.macAddress).toBe("02:42:ac:11:00:02");
    });

    it("maps mounts", () => {
      const result = helpers.mapContainerInfoDetailed(makeDetailedInfo());
      expect(result.mounts).toHaveLength(2);
      expect(result.mounts[0]).toEqual({
        type: "volume",
        source: "vol-data",
        destination: "/data",
        mode: "rw",
        rw: true,
      });
      expect(result.mounts[1]).toEqual({
        type: "bind",
        source: "/host/path",
        destination: "/container/path",
        mode: "ro",
        rw: false,
      });
    });

    it("maps health check info", () => {
      const result = helpers.mapContainerInfoDetailed(makeDetailedInfo());
      expect(result.health).toBeDefined();
      expect(result.health!.status).toBe("healthy");
      expect(result.health!.failingStreak).toBe(0);
      expect(result.health!.log).toHaveLength(1);
    });

    it("omits health when not present", () => {
      const info = makeDetailedInfo();
      delete info.State.Health;
      const result = helpers.mapContainerInfoDetailed(info);
      expect(result.health).toBeUndefined();
    });

    it("maps config", () => {
      const result = helpers.mapContainerInfoDetailed(makeDetailedInfo());
      expect(result.config.hostname).toBe("abc123");
      expect(result.config.env).toEqual(["NODE_ENV=production", "PORT=3000"]);
      expect(result.config.cmd).toEqual(["node", "server.js"]);
      expect(result.config.labels).toEqual({ app: "web" });
      expect(result.config.workingDir).toBe("/app");
    });

    it("maps networkSettings", () => {
      const result = helpers.mapContainerInfoDetailed(makeDetailedInfo());
      expect(result.networkSettings.ipAddress).toBe("172.17.0.2");
      expect(result.networkSettings.gateway).toBe("172.17.0.1");
    });

    it("handles missing Ports", () => {
      const info = makeDetailedInfo();
      info.NetworkSettings.Ports = null;
      const result = helpers.mapContainerInfoDetailed(info);
      expect(result.networkSettings.ports).toEqual({});
    });

    it("handles missing Networks", () => {
      const info = makeDetailedInfo();
      info.NetworkSettings.Networks = {};
      const result = helpers.mapContainerInfoDetailed(info);
      expect(result.networkSettings.networks).toEqual({});
    });

    it("handles null port binding entries", () => {
      const info = makeDetailedInfo();
      info.NetworkSettings.Ports = { "80/tcp": null };
      const result = helpers.mapContainerInfoDetailed(makeDetailedInfo());
      expect(result.networkSettings.ports["80/tcp"]).toEqual([
        { hostIp: "0.0.0.0", hostPort: "8080" },
      ]);
    });
  });

  describe("mapStats", () => {
    function makeContainerStats(overrides: any = {}): any {
      return {
        cpu_stats: {
          cpu_usage: { total_usage: 500000000 },
          system_cpu_usage: 2000000000,
          online_cpus: 4,
        },
        precpu_stats: {
          cpu_usage: { total_usage: 400000000 },
          system_cpu_usage: 1900000000,
        },
        memory_stats: {
          usage: 100_000_000,
          limit: 2_000_000_000,
        },
        networks: {
          eth0: { rx_bytes: 1000, tx_bytes: 2000, rx_packets: 10, tx_packets: 20 },
          eth1: { rx_bytes: 500, tx_bytes: 1000, rx_packets: 5, tx_packets: 10 },
        },
        blkio_stats: {
          io_service_bytes_recursive: [
            { op: "read", value: 4096 },
            { op: "write", value: 8192 },
          ],
        },
        ...overrides,
      };
    }

    it("maps cpu usage percentage", () => {
      const result = helpers.mapStats(makeContainerStats());
      expect(result.cpu.usage).toBeGreaterThan(0);
      expect(result.cpu.systemUsage).toBe(2000000000);
      expect(result.cpu.onlineCpus).toBe(4);
    });

    it("maps memory usage, limit, and percentage", () => {
      const result = helpers.mapStats(makeContainerStats());
      expect(result.memory.usage).toBe(100_000_000);
      expect(result.memory.limit).toBe(2_000_000_000);
      expect(result.memory.percentage).toBe(5);
    });

    it("maps network rx/tx bytes and packets (sums across interfaces)", () => {
      const result = helpers.mapStats(makeContainerStats());
      expect(result.network.rxBytes).toBe(1500);
      expect(result.network.txBytes).toBe(3000);
      expect(result.network.rxPackets).toBe(15);
      expect(result.network.txPackets).toBe(30);
    });

    it("maps block IO read and write bytes", () => {
      const result = helpers.mapStats(makeContainerStats());
      expect(result.blockIO.readBytes).toBe(4096);
      expect(result.blockIO.writeBytes).toBe(8192);
    });

    it("handles missing network data (returns zeros)", () => {
      const result = helpers.mapStats(makeContainerStats({ networks: {} }));
      expect(result.network.rxBytes).toBe(0);
      expect(result.network.txBytes).toBe(0);
      expect(result.network.rxPackets).toBe(0);
      expect(result.network.txPackets).toBe(0);
    });

    it("handles missing blkio stats (returns zeros)", () => {
      const result = helpers.mapStats(makeContainerStats({ blkio_stats: {} }));
      expect(result.blockIO.readBytes).toBe(0);
      expect(result.blockIO.writeBytes).toBe(0);
    });

    it("returns zero cpu when system delta is zero", () => {
      const stats = makeContainerStats();
      stats.precpu_stats.system_cpu_usage = stats.cpu_stats.system_cpu_usage;
      const result = helpers.mapStats(stats);
      expect(result.cpu.usage).toBe(0);
    });
  });

  describe("mapNetworkInfo", () => {
    it("maps network inspect info to Network shape", () => {
      const info = {
        Id: "net-abc",
        Name: "my-network",
        Driver: "bridge",
        Scope: "local",
        Internal: false,
        Attachable: true,
        Created: 1704067200000,
        Labels: { app: "web" },
      };

      const result = helpers.mapNetworkInfo(info);
      expect(result.id).toBe("net-abc");
      expect(result.name).toBe("my-network");
      expect(result.driver).toBe("bridge");
      expect(result.scope).toBe("local");
      expect(result.internal).toBe(false);
      expect(result.attachable).toBe(true);
      expect(result.created).toBeInstanceOf(Date);
      expect(result.labels).toEqual({ app: "web" });
    });
  });

  describe("mapVolumeInfo", () => {
    it("maps volume inspect info to Volume shape", () => {
      const info = {
        Name: "my-volume",
        Driver: "local",
        Mountpoint: "/var/lib/docker/volumes/my-volume/_data",
        Labels: { env: "prod" },
      };

      const result = helpers.mapVolumeInfo(info);
      expect(result.name).toBe("my-volume");
      expect(result.driver).toBe("local");
      expect(result.mountpoint).toBe("/var/lib/docker/volumes/my-volume/_data");
      expect(result.labels).toEqual({ env: "prod" });
    });

    it("sets created date when CreatedAt is present", () => {
      const info = {
        Name: "vol",
        Driver: "local",
        Mountpoint: "/data",
        CreatedAt: "2024-01-15T10:30:00Z",
      };

      const result = helpers.mapVolumeInfo(info);
      expect(result.created).toBeInstanceOf(Date);
    });

    it("omits created when CreatedAt is absent", () => {
      const info = {
        Name: "vol",
        Driver: "local",
        Mountpoint: "/data",
      };

      const result = helpers.mapVolumeInfo(info);
      expect(result.created).toBeUndefined();
    });
  });
});
