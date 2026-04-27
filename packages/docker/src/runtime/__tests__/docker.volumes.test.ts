import { describe, it, expect, beforeEach, vi } from "vitest";
import { DockerRuntime } from "../docker";

function createMockRuntime(): DockerRuntime {
  const runtime = new DockerRuntime({ socketPath: "/mock/docker.sock" });
  (runtime as any).docker = {
    getContainer: vi.fn(),
    getVolume: vi.fn(),
    createVolume: vi.fn(),
    listVolumes: vi.fn(),
  };
  return runtime;
}

describe("DockerRuntime volumes", () => {
  let runtime: DockerRuntime;
  let mockDocker: any;

  beforeEach(() => {
    runtime = createMockRuntime();
    mockDocker = (runtime as any).docker;
  });

  describe("createVolume", () => {
    it("creates volume with name and inspects result", async () => {
      mockDocker.createVolume.mockResolvedValue({});
      mockDocker.getVolume.mockReturnValue({
        inspect: vi.fn().mockResolvedValue({
          Name: "my-volume",
          Driver: "local",
          Mountpoint: "/var/lib/docker/volumes/my-volume/_data",
          Labels: {},
        }),
      });

      const result = await runtime.createVolume({ name: "my-volume" });

      expect(mockDocker.createVolume).toHaveBeenCalledWith(
        expect.objectContaining({ Name: "my-volume" })
      );
      expect(result.name).toBe("my-volume");
      expect(result.driver).toBe("local");
      expect(result.mountpoint).toBe("/var/lib/docker/volumes/my-volume/_data");
    });

    it("passes driver, labels, and driver options", async () => {
      mockDocker.createVolume.mockResolvedValue({});
      mockDocker.getVolume.mockReturnValue({
        inspect: vi.fn().mockResolvedValue({
          Name: "vol",
          Driver: "nfs",
          Mountpoint: "/mnt/vol",
          Labels: { env: "prod" },
        }),
      });

      await runtime.createVolume({
        name: "vol",
        driver: "nfs",
        labels: { env: "prod" },
        options: { addr: "nfs-server:/data" },
      });

      expect(mockDocker.createVolume).toHaveBeenCalledWith({
        Name: "vol",
        Driver: "nfs",
        Labels: { env: "prod" },
        DriverOpts: { addr: "nfs-server:/data" },
      });
    });
  });

  describe("removeVolume", () => {
    it("calls volume.remove() with volume name", async () => {
      const mockVolume = { remove: vi.fn().mockResolvedValue(undefined) };
      mockDocker.getVolume.mockReturnValue(mockVolume);

      await runtime.removeVolume("my-volume");

      expect(mockDocker.getVolume).toHaveBeenCalledWith("my-volume");
      expect(mockVolume.remove).toHaveBeenCalled();
    });
  });

  describe("listVolumes", () => {
    it("lists volumes from result.Volumes and maps each", async () => {
      mockDocker.listVolumes.mockResolvedValue({
        Volumes: [
          { Name: "vol-1", Driver: "local", Mountpoint: "/data/vol-1", Labels: {} },
          { Name: "vol-2", Driver: "local", Mountpoint: "/data/vol-2", Labels: { app: "db" } },
        ],
      });

      const volumes = await runtime.listVolumes();

      expect(volumes).toHaveLength(2);
      expect(volumes[0].name).toBe("vol-1");
      expect(volumes[1].name).toBe("vol-2");
      expect(volumes[1].labels).toEqual({ app: "db" });
    });

    it("handles empty Volumes array", async () => {
      mockDocker.listVolumes.mockResolvedValue({ Volumes: [] });

      const volumes = await runtime.listVolumes();
      expect(volumes).toEqual([]);
    });

    it("handles missing Volumes", async () => {
      mockDocker.listVolumes.mockResolvedValue({});

      const volumes = await runtime.listVolumes();
      expect(volumes).toEqual([]);
    });

    it("applies name filters", async () => {
      mockDocker.listVolumes.mockResolvedValue({ Volumes: [] });
      await runtime.listVolumes({ name: ["my-volume"] });

      const callArgs = mockDocker.listVolumes.mock.calls[0][0] as { filters: string };
      const filters = JSON.parse(callArgs.filters);
      expect(filters.name).toContain("my-volume");
    });

    it("applies label filters", async () => {
      mockDocker.listVolumes.mockResolvedValue({ Volumes: [] });
      await runtime.listVolumes({ label: { app: "web" } });

      const callArgs = mockDocker.listVolumes.mock.calls[0][0] as { filters: string };
      const filters = JSON.parse(callArgs.filters);
      expect(filters.label).toContain("app=web");
    });
  });
});
