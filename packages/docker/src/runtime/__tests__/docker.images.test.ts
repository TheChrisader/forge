import { describe, it, expect, beforeEach, vi } from "vitest";
import { DockerRuntime } from "../docker";
import { Readable } from "node:stream";

function createMockRuntime(): DockerRuntime {
  const runtime = new DockerRuntime({ socketPath: "/mock/docker.sock" });
  (runtime as any).docker = {
    getContainer: vi.fn(),
    getImage: vi.fn(),
    listImages: vi.fn(),
    pull: vi.fn(),
    modem: {
      demuxStream: vi.fn(),
      followProgress: vi.fn(),
    },
  };
  return runtime;
}

describe("DockerRuntime images", () => {
  let runtime: DockerRuntime;
  let mockDocker: any;

  beforeEach(() => {
    runtime = createMockRuntime();
    mockDocker = (runtime as any).docker;
  });

  describe("pullImage", () => {
    it("constructs image name as 'name:tag' defaulting tag to 'latest'", async () => {
      const mockStream = new Readable({
        read(): void {
          this.push(null);
        },
      });
      mockDocker.pull.mockImplementation(
        (_img: string, _opts: unknown, cb: (err: Error | null, stream: Readable) => void) => {
          cb(null, mockStream);
        }
      );
      mockDocker.modem.followProgress.mockImplementation(
        (_stream: unknown, onFinished: (err: Error | null) => void) => onFinished(null)
      );

      await runtime.pullImage("nginx");

      expect(mockDocker.pull).toHaveBeenCalledWith(
        "nginx:latest",
        expect.any(Object),
        expect.any(Function)
      );
    });

    it("uses provided tag instead of default", async () => {
      const mockStream = new Readable({
        read(): void {
          this.push(null);
        },
      });
      mockDocker.pull.mockImplementation(
        (_img: string, _opts: unknown, cb: (err: Error | null, stream: Readable) => void) => {
          cb(null, mockStream);
        }
      );
      mockDocker.modem.followProgress.mockImplementation(
        (_stream: unknown, onFinished: (err: Error | null) => void) => onFinished(null)
      );

      await runtime.pullImage("nginx", { tag: "1.25" });

      expect(mockDocker.pull).toHaveBeenCalledWith(
        "nginx:1.25",
        expect.any(Object),
        expect.any(Function)
      );
    });

    it("passes authconfig to docker.pull", async () => {
      const mockStream = new Readable({
        read(): void {
          this.push(null);
        },
      });
      mockDocker.pull.mockImplementation(
        (_img: string, _opts: unknown, cb: (err: Error | null, stream: Readable) => void) => {
          cb(null, mockStream);
        }
      );
      mockDocker.modem.followProgress.mockImplementation(
        (_stream: unknown, onFinished: (err: Error | null) => void) => onFinished(null)
      );

      const authconfig = { username: "user", password: "pass" };
      await runtime.pullImage("my-registry.com/app", { authconfig });

      expect(mockDocker.pull).toHaveBeenCalledWith(
        expect.any(String),
        { authconfig },
        expect.any(Function)
      );
    });

    it("calls onProgress callback for each progress event", async () => {
      const mockStream = new Readable({
        read(): void {
          this.push(null);
        },
      });
      mockDocker.pull.mockImplementation(
        (_img: string, _opts: unknown, cb: (err: Error | null, stream: Readable) => void) => {
          cb(null, mockStream);
        }
      );

      mockDocker.modem.followProgress.mockImplementation(
        (
          _stream: unknown,
          onFinished: (err: Error | null) => void,
          onProgress: (event: unknown) => void
        ) => {
          onProgress({ status: "Pulling from nginx" });
          onProgress({ progress: { current: 50, total: 100 } });
          onFinished(null);
        }
      );

      const progressEvents: unknown[] = [];
      await runtime.pullImage("nginx", { onProgress: (e) => progressEvents.push(e) });

      expect(progressEvents).toHaveLength(2);
    });

    it("rejects when docker.pull returns an error", async () => {
      mockDocker.pull.mockImplementation(
        (_img: string, _opts: unknown, cb: (err: Error, stream?: Readable) => void) => {
          cb(new Error("connection refused"));
        }
      );

      await expect(runtime.pullImage("nginx")).rejects.toThrow("connection refused");
    });

    it("rejects when followProgress returns an error", async () => {
      const mockStream = new Readable({
        read(): void {
          this.push(null);
        },
      });
      mockDocker.pull.mockImplementation(
        (_img: string, _opts: unknown, cb: (err: Error | null, stream: Readable) => void) => {
          cb(null, mockStream);
        }
      );
      mockDocker.modem.followProgress.mockImplementation(
        (_stream: unknown, onFinished: (err: Error) => void) => onFinished(new Error("pull failed"))
      );

      await expect(runtime.pullImage("nginx")).rejects.toThrow("pull failed");
    });
  });

  describe("removeImage", () => {
    it("calls image.remove with force and noprune options", async () => {
      const mockImage = { remove: vi.fn().mockResolvedValue(undefined) };
      mockDocker.getImage.mockReturnValue(mockImage);

      await runtime.removeImage("sha256:abc123", { force: true, noPrune: true });

      expect(mockDocker.getImage).toHaveBeenCalledWith("sha256:abc123");
      expect(mockImage.remove).toHaveBeenCalledWith({ force: true, noprune: true });
    });
  });

  describe("listImages", () => {
    it("lists all images and maps to Image interface", async () => {
      mockDocker.listImages.mockResolvedValue([
        {
          Id: "sha256:abc",
          RepoTags: ["nginx:latest"],
          Created: 1704067200,
          Size: 100_000_000,
          Labels: { app: "web" },
        },
        { Id: "sha256:def", RepoTags: null, Created: 1704067300, Size: 50_000_000, Labels: {} },
      ]);

      const images = await runtime.listImages();

      expect(images).toHaveLength(2);
      expect(images[0].id).toBe("sha256:abc");
      expect(images[0].repoTags).toEqual(["nginx:latest"]);
      expect(images[0].size).toBe(100_000_000);
      expect(images[0].labels).toEqual({ app: "web" });
      expect(images[0].created).toBeInstanceOf(Date);
      expect(images[1].repoTags).toEqual([]);
    });

    it("applies reference filters", async () => {
      mockDocker.listImages.mockResolvedValue([]);
      await runtime.listImages({ reference: ["nginx*"] });

      const callArgs = mockDocker.listImages.mock.calls[0][0] as { filters: string };
      const filters = JSON.parse(callArgs.filters);
      expect(filters.reference).toContain("nginx*");
    });

    it("applies label filters", async () => {
      mockDocker.listImages.mockResolvedValue([]);
      await runtime.listImages({ label: { app: "web" } });

      const callArgs = mockDocker.listImages.mock.calls[0][0] as { filters: string };
      const filters = JSON.parse(callArgs.filters);
      expect(filters.label).toContain("app=web");
    });

    it("applies dangling filter", async () => {
      mockDocker.listImages.mockResolvedValue([]);
      await runtime.listImages({ dangling: true });

      const callArgs = mockDocker.listImages.mock.calls[0][0] as { filters: string };
      const filters = JSON.parse(callArgs.filters);
      expect(filters.dangling).toEqual(["true"]);
    });
  });

  describe("pruneDanglingImages", () => {
    it("calls docker.pruneImages with dangling filter and returns result", async () => {
      mockDocker.pruneImages = vi.fn().mockResolvedValue({
        ImagesDeleted: [{ Untagged: "nginx:latest" }, { Deleted: "sha256:abc123" }],
        SpaceReclaimed: 500_000_000,
      });

      const result = await runtime.pruneDanglingImages();

      expect(result.deleted).toEqual(["nginx:latest", "sha256:abc123"]);
      expect(result.reclaimedBytes).toBe(500_000_000);
    });

    it("handles empty ImagesDeleted array", async () => {
      mockDocker.pruneImages = vi.fn().mockResolvedValue({
        ImagesDeleted: [],
        SpaceReclaimed: 0,
      });

      const result = await runtime.pruneDanglingImages();
      expect(result.deleted).toEqual([]);
      expect(result.reclaimedBytes).toBe(0);
    });
  });

  describe("pruneOldImages", () => {
    it("filters and removes old images by tag prefix and age", async () => {
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      mockDocker.listImages.mockResolvedValue([
        {
          Id: "sha256:old",
          RepoTags: ["myapp:v1"],
          Created: cutoffDate.getTime() / 1000 - 100,
          Size: 100_000,
        },
        { Id: "sha256:new", RepoTags: ["myapp:v2"], Created: Date.now() / 1000, Size: 200_000 },
        {
          Id: "sha256:other",
          RepoTags: ["nginx:latest"],
          Created: cutoffDate.getTime() / 1000 - 200,
          Size: 150_000,
        },
      ]);

      const mockImage = { remove: vi.fn().mockResolvedValue(undefined) };
      mockDocker.getImage.mockReturnValue(mockImage);

      const result = await runtime.pruneOldImages("myapp:", 30);

      expect(result.deleted).toContain("sha256:old");
      expect(result.reclaimedBytes).toBe(100_000);
      expect(result.errors).toEqual([]);
    });

    it("collects errors for images that fail to remove", async () => {
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      mockDocker.listImages.mockResolvedValue([
        {
          Id: "sha256:fail",
          RepoTags: ["myapp:v1"],
          Created: cutoffDate.getTime() / 1000 - 100,
          Size: 100_000,
        },
      ]);

      mockDocker.getImage.mockReturnValue({
        remove: vi.fn().mockRejectedValue(new Error("in use")),
      });

      const result = await runtime.pruneOldImages("myapp:", 30);

      expect(result.deleted).toEqual([]);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("in use");
    });

    it("skips images without matching tag prefix", async () => {
      mockDocker.listImages.mockResolvedValue([
        { Id: "sha256:other", RepoTags: ["nginx:latest"], Created: 0, Size: 100_000 },
      ]);

      const result = await runtime.pruneOldImages("myapp:", 30);

      expect(result.deleted).toEqual([]);
      expect(mockDocker.getImage).not.toHaveBeenCalled();
    });
  });

  describe("getImageDiskUsage", () => {
    it("returns count and total bytes for non-dangling images", async () => {
      mockDocker.listImages.mockResolvedValue([
        {
          Id: "sha256:1",
          RepoTags: ["nginx:latest"],
          Created: 1704067200,
          Size: 100_000_000,
          Labels: {},
        },
        {
          Id: "sha256:2",
          RepoTags: ["redis:7"],
          Created: 1704067300,
          Size: 50_000_000,
          Labels: {},
        },
      ]);

      const result = await runtime.getImageDiskUsage();

      expect(result.count).toBe(2);
      expect(result.totalBytes).toBe(150_000_000);
    });

    it("filters by tagPrefix when provided", async () => {
      mockDocker.listImages.mockResolvedValue([
        { Id: "sha256:1", RepoTags: ["myapp:v1"], Created: 1704067200, Size: 100_000, Labels: {} },
        {
          Id: "sha256:2",
          RepoTags: ["nginx:latest"],
          Created: 1704067300,
          Size: 200_000,
          Labels: {},
        },
      ]);

      const result = await runtime.getImageDiskUsage("myapp:");

      expect(result.count).toBe(1);
      expect(result.totalBytes).toBe(100_000);
    });

    it("returns zero when no images match", async () => {
      mockDocker.listImages.mockResolvedValue([]);

      const result = await runtime.getImageDiskUsage("myapp:");

      expect(result.count).toBe(0);
      expect(result.totalBytes).toBe(0);
    });
  });
});
