import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DockerfileBuildStrategy } from "../strategies/dockerfile.strategy.js";
import { NodeJsBuildStrategy } from "../strategies/nodejs.strategy.js";
import { BuildStrategyRegistry, type BuildProgressEvent } from "../index.js";
import type { BuildProgressCallback } from "../interfaces/strategy.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

const mockDockerRuntime = {
  buildImage: vi.fn().mockResolvedValue({
    imageId: "sha256:test123",
    warnings: [],
  }),
};

vi.mock("@forge/docker", () => ({
  DockerRuntime: vi.fn(function () {
    return mockDockerRuntime;
  }),
}));

describe("Build Strategy Progress Callback Integration", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `forge-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("DockerfileBuildStrategy", () => {
    it("calls progress callback during build", async () => {
      const strategy = new DockerfileBuildStrategy();
      await fs.writeFile(path.join(tempDir, "Dockerfile"), "FROM node:20");

      const events: BuildProgressEvent[] = [];
      const onProgress: BuildProgressCallback = (event) => {
        events.push(event);
      };

      const result = await strategy.build(
        {
          projectName: "test-project",
          projectId: "test-project",
          deploymentId: "test-deployment",
          sourceDir: tempDir,
          workDir: tempDir,
          outputDir: path.join(tempDir, "output"),
        },
        undefined,
        onProgress
      );

      expect(result.success).toBe(true);
      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e) => e.type === "complete")).toBe(true);
      expect(events.some((e) => e.type === "stage")).toBe(true);
    });

    it("calls progress callback with error when Dockerfile not found", async () => {
      const strategy = new DockerfileBuildStrategy();

      const events: BuildProgressEvent[] = [];
      const onProgress: BuildProgressCallback = (event) => {
        events.push(event);
      };

      await expect(
        strategy.build(
          {
            projectName: "test-project",
            projectId: "test-project",
            deploymentId: "test-deployment",
            sourceDir: tempDir,
            workDir: tempDir,
            outputDir: path.join(tempDir, "output"),
          },
          undefined,
          onProgress
        )
      ).rejects.toThrow();

      expect(events.some((e) => e.type === "error")).toBe(true);
    });

    it("works without callback (backward compatibility)", async () => {
      const strategy = new DockerfileBuildStrategy();
      await fs.writeFile(path.join(tempDir, "Dockerfile"), "FROM node:20");

      const result = await strategy.build(
        {
          projectName: "test-project",
          projectId: "test-project",
          deploymentId: "test-deployment",
          sourceDir: tempDir,
          workDir: tempDir,
          outputDir: path.join(tempDir, "output"),
        },
        undefined
      );

      expect(result.success).toBe(true);
    });
  });

  describe("NodeJsBuildStrategy", () => {
    it("calls progress callback during build", async () => {
      const strategy = new NodeJsBuildStrategy();
      await fs.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "test", dependencies: { express: "^4.0.0" } })
      );

      const events: BuildProgressEvent[] = [];
      const onProgress: BuildProgressCallback = (event) => {
        events.push(event);
      };

      const result = await strategy.build(
        {
          projectName: "test-project",
          projectId: "test-project",
          deploymentId: "test-deployment",
          sourceDir: tempDir,
          workDir: tempDir,
          outputDir: path.join(tempDir, "output"),
        },
        undefined,
        onProgress
      );

      expect(result.success).toBe(true);
      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e) => e.type === "complete")).toBe(true);
    });

    it("works without callback (backward compatibility)", async () => {
      const strategy = new NodeJsBuildStrategy();
      await fs.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "test", dependencies: { express: "^4.0.0" } })
      );

      const result = await strategy.build(
        {
          projectName: "test-project",
          projectId: "test-project",
          deploymentId: "test-deployment",
          sourceDir: tempDir,
          workDir: tempDir,
          outputDir: path.join(tempDir, "output"),
        },
        undefined
      );

      expect(result.success).toBe(true);
    });
  });

  describe("BuildStrategyRegistry", () => {
    it("throws NoStrategyFoundError when no strategy matches", async () => {
      const registry = new BuildStrategyRegistry();

      await expect(
        registry.detect({
          projectName: "test",
          projectId: "test",
          deploymentId: "test",
          sourceDir: tempDir,
          workDir: tempDir,
          outputDir: path.join(tempDir, "output"),
        })
      ).rejects.toThrow("No build strategy available");
    });
  });
});
