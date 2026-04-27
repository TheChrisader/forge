import { describe, it, expect, vi, beforeEach } from "vitest";
import { DockerRuntime } from "../docker.js";
import { Readable } from "node:stream";

vi.mock(
  "tar-fs",
  (): Record<string, unknown> => ({
    pack: (): Readable => {
      return new Readable({
        read(): void {
          this.push(null);
        },
      });
    },
  })
);

vi.mock("node:path", async (importOriginal): Promise<Record<string, unknown>> => {
  const actual = await importOriginal<typeof import("node:path")>();
  return {
    ...actual,
    default: actual,
    basename: (): string => "test",
    join: (...args: string[]): string => args.join("/"),
  } as unknown as Record<string, unknown>;
});

describe("DockerRuntime.buildImage", () => {
  let runtime: DockerRuntime;
  let mockDocker: any;

  beforeEach(() => {
    mockDocker = {
      buildImage: vi.fn(),
      getImage: vi.fn(() => ({
        inspect: vi.fn().mockResolvedValue({
          Size: 100_000_000,
          RootFS: { Layers: ["sha256:abc", "sha256:def"] },
        }),
      })),
    };

    runtime = new DockerRuntime({ socketPath: "/mock/docker.sock" });
    (runtime as any).docker = mockDocker;
  });

  it("builds an image and returns metadata", async () => {
    const mockStream = new Readable({
      read(): void {
        this.push(JSON.stringify({ stream: "Step 1/3 : FROM node:20\n" }) + "\n");
        this.push(JSON.stringify({ stream: "Step 2/3 : COPY . .\n" }) + "\n");
        this.push(JSON.stringify({ aux: { ID: "sha256:abc123" } }) + "\n");
        this.push(null);
      },
    });

    mockDocker.buildImage.mockResolvedValue(mockStream);

    const result = await runtime.buildImage("/tmp/test", {
      tags: ["test:latest"],
    });

    expect(result.imageId).toBe("sha256:abc123");
    expect(result.sizeBytes).toBe(100_000_000);
    expect(result.layers).toHaveLength(2);
  });

  it("emits progress events through onProgress callback", async () => {
    const mockStream = new Readable({
      read(): void {
        this.push(JSON.stringify({ stream: "Building...\n" }) + "\n");
        this.push(JSON.stringify({ aux: { ID: "sha256:abc" } }) + "\n");
        this.push(null);
      },
    });

    mockDocker.buildImage.mockResolvedValue(mockStream);

    const progressEvents: any[] = [];

    await runtime.buildImage("/tmp/test", {
      tags: ["test:latest"],
      onProgress: (progress) => progressEvents.push(progress),
    });

    expect(progressEvents.length).toBeGreaterThan(0);
    expect(progressEvents.some((e) => e.stream?.includes("Building"))).toBe(true);
  });

  it("throws DockerSyntaxError on Dockerfile parse error", async () => {
    const mockStream = new Readable({
      read(): void {
        this.push(
          JSON.stringify({
            errorDetail: { message: "Dockerfile parse error: unknown instruction: FOO" },
          }) + "\n"
        );
        this.push(null);
      },
    });

    mockDocker.buildImage.mockResolvedValue(mockStream);

    await expect(runtime.buildImage("/tmp/test", { tags: ["test:latest"] })).rejects.toThrow(
      "Dockerfile syntax error"
    );
  });

  it("collects warnings during build", async () => {
    const mockStream = new Readable({
      read(): void {
        this.push(JSON.stringify({ stream: "Warning: apt-key deprecated\n" }) + "\n");
        this.push(JSON.stringify({ aux: { ID: "sha256:abc" } }) + "\n");
        this.push(null);
      },
    });

    mockDocker.buildImage.mockResolvedValue(mockStream);

    const result = await runtime.buildImage("/tmp/test", {
      tags: ["test:latest"],
    });

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("apt-key deprecated");
  });
});
