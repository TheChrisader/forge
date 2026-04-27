import { describe, it, expect, beforeEach, vi } from "vitest";
import { DockerRuntime } from "../docker";

function createMockRuntime(): DockerRuntime {
  const runtime = new DockerRuntime({ socketPath: "/mock/docker.sock" });
  (runtime as any).docker = {
    getContainer: vi.fn(),
    getNetwork: vi.fn(),
    createNetwork: vi.fn(),
    listNetworks: vi.fn(),
  };
  return runtime;
}

describe("DockerRuntime networks", () => {
  let runtime: DockerRuntime;
  let mockDocker: any;

  beforeEach(() => {
    runtime = createMockRuntime();
    mockDocker = (runtime as any).docker;
  });

  describe("createNetwork", () => {
    it("creates network with name and default bridge driver", async () => {
      const mockNetwork = {
        inspect: vi.fn().mockResolvedValue({
          Id: "net-abc",
          Name: "my-network",
          Driver: "bridge",
          Scope: "local",
          Internal: false,
          Attachable: false,
          Created: 1704067200000,
          Labels: {},
        }),
      };
      mockDocker.createNetwork.mockResolvedValue(mockNetwork);

      const result = await runtime.createNetwork({ name: "my-network" });

      expect(mockDocker.createNetwork).toHaveBeenCalledWith(
        expect.objectContaining({ Name: "my-network", Driver: "bridge" })
      );
      expect(result.id).toBe("net-abc");
      expect(result.name).toBe("my-network");
    });

    it("passes custom driver", async () => {
      const mockNetwork = {
        inspect: vi.fn().mockResolvedValue({
          Id: "net-1",
          Name: "overlay-net",
          Driver: "overlay",
          Scope: "swarm",
          Internal: false,
          Attachable: false,
          Created: 1704067200000,
          Labels: {},
        }),
      };
      mockDocker.createNetwork.mockResolvedValue(mockNetwork);

      await runtime.createNetwork({ name: "overlay-net", driver: "overlay" });

      expect(mockDocker.createNetwork).toHaveBeenCalledWith(
        expect.objectContaining({ Driver: "overlay" })
      );
    });

    it("passes internal, attachable, labels, and options", async () => {
      const mockNetwork = {
        inspect: vi.fn().mockResolvedValue({
          Id: "net-1",
          Name: "net",
          Driver: "bridge",
          Scope: "local",
          Internal: true,
          Attachable: true,
          Created: 1704067200000,
          Labels: { app: "web" },
        }),
      };
      mockDocker.createNetwork.mockResolvedValue(mockNetwork);

      await runtime.createNetwork({
        name: "net",
        internal: true,
        attachable: true,
        labels: { app: "web" },
        options: { "com.docker.network.bridge.enable_icc": "true" },
      });

      expect(mockDocker.createNetwork).toHaveBeenCalledWith({
        Name: "net",
        Driver: "bridge",
        Internal: true,
        Attachable: true,
        Labels: { app: "web" },
        Options: { "com.docker.network.bridge.enable_icc": "true" },
      });
    });
  });

  describe("removeNetwork", () => {
    it("calls network.remove() with network id", async () => {
      const mockNetwork = { remove: vi.fn().mockResolvedValue(undefined) };
      mockDocker.getNetwork.mockReturnValue(mockNetwork);

      await runtime.removeNetwork("net-abc");

      expect(mockDocker.getNetwork).toHaveBeenCalledWith("net-abc");
      expect(mockNetwork.remove).toHaveBeenCalled();
    });
  });

  describe("listNetworks", () => {
    it("lists networks and maps each via mapNetworkInfo", async () => {
      mockDocker.listNetworks.mockResolvedValue([
        {
          Id: "net-1",
          Name: "bridge",
          Driver: "bridge",
          Scope: "local",
          Internal: false,
          Attachable: false,
          Created: 1704067200000,
          Labels: {},
        },
        {
          Id: "net-2",
          Name: "custom",
          Driver: "bridge",
          Scope: "local",
          Internal: false,
          Attachable: true,
          Created: 1704067300000,
          Labels: { app: "web" },
        },
      ]);

      const networks = await runtime.listNetworks();

      expect(networks).toHaveLength(2);
      expect(networks[0].id).toBe("net-1");
      expect(networks[0].name).toBe("bridge");
      expect(networks[1].labels).toEqual({ app: "web" });
    });

    it("applies name filters", async () => {
      mockDocker.listNetworks.mockResolvedValue([]);
      await runtime.listNetworks({ name: ["my-network"] });

      const callArgs = mockDocker.listNetworks.mock.calls[0][0] as { filters: string };
      const filters = JSON.parse(callArgs.filters);
      expect(filters.name).toContain("my-network");
    });

    it("applies id filters", async () => {
      mockDocker.listNetworks.mockResolvedValue([]);
      await runtime.listNetworks({ id: ["net-abc"] });

      const callArgs = mockDocker.listNetworks.mock.calls[0][0] as { filters: string };
      const filters = JSON.parse(callArgs.filters);
      expect(filters.id).toContain("net-abc");
    });

    it("applies label filters", async () => {
      mockDocker.listNetworks.mockResolvedValue([]);
      await runtime.listNetworks({ label: { app: "web" } });

      const callArgs = mockDocker.listNetworks.mock.calls[0][0] as { filters: string };
      const filters = JSON.parse(callArgs.filters);
      expect(filters.label).toContain("app=web");
    });
  });

  describe("connectNetwork", () => {
    it("connects container to network with config", async () => {
      const mockNetwork = { connect: vi.fn().mockResolvedValue(undefined) };
      mockDocker.getNetwork.mockReturnValue(mockNetwork);

      await runtime.connectNetwork("container-123", "net-abc", {
        aliases: ["web", "app"],
        ipAddress: "172.17.0.10",
      });

      expect(mockNetwork.connect).toHaveBeenCalledWith({
        Container: "container-123",
        EndpointConfig: {
          Aliases: ["web", "app"],
          IPAddress: "172.17.0.10",
          Links: undefined,
        },
      });
    });

    it("connects without config (undefined EndpointConfig)", async () => {
      const mockNetwork = { connect: vi.fn().mockResolvedValue(undefined) };
      mockDocker.getNetwork.mockReturnValue(mockNetwork);

      await runtime.connectNetwork("container-123", "net-abc");

      expect(mockNetwork.connect).toHaveBeenCalledWith({
        Container: "container-123",
        EndpointConfig: undefined,
      });
    });
  });

  describe("disconnectNetwork", () => {
    it("disconnects container from network with force option", async () => {
      const mockNetwork = { disconnect: vi.fn().mockResolvedValue(undefined) };
      mockDocker.getNetwork.mockReturnValue(mockNetwork);

      await runtime.disconnectNetwork("container-123", "net-abc", true);

      expect(mockNetwork.disconnect).toHaveBeenCalledWith({
        Container: "container-123",
        Force: true,
      });
    });

    it("defaults force to false", async () => {
      const mockNetwork = { disconnect: vi.fn().mockResolvedValue(undefined) };
      mockDocker.getNetwork.mockReturnValue(mockNetwork);

      await runtime.disconnectNetwork("container-123", "net-abc");

      expect(mockNetwork.disconnect).toHaveBeenCalledWith({
        Container: "container-123",
        Force: false,
      });
    });
  });
});
