import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "eventemitter3";
import { DockerfileBuildStrategy } from "../strategies/dockerfile.strategy.js";
import { NodeJsBuildStrategy } from "../strategies/nodejs.strategy.js";
import { BuildStrategyRegistry, type BuildProgressEvent } from "../index.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

describe("Build Strategy EventEmitter Integration", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `forge-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("DockerfileBuildStrategy", () => {
    it("emits progress events during build", async () => {
      const strategy = new DockerfileBuildStrategy();
      await fs.writeFile(path.join(tempDir, "Dockerfile"), "FROM node:20");

      const emitter = new EventEmitter();
      const events: unknown[] = [];

      emitter.on("progress", (data: BuildProgressEvent) => events.push(data));

      const result = await strategy.build(
        {
          projectId: "test-project",
          deploymentId: "test-deployment",
          sourceDir: tempDir,
          workDir: tempDir,
          outputDir: path.join(tempDir, "output"),
        },
        undefined,
        emitter
      );

      expect(result.success).toBe(true);
      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e: any) => e.type === "complete")).toBe(true);
      expect(events.some((e: any) => e.type === "stage")).toBe(true);
    });

    it("emits error when Dockerfile not found", async () => {
      const strategy = new DockerfileBuildStrategy();

      const emitter = new EventEmitter();
      const events: unknown[] = [];

      emitter.on("progress", (data: BuildProgressEvent) => events.push(data));

      await expect(strategy.build(
        {
          projectId: "test-project",
          deploymentId: "test-deployment",
          sourceDir: tempDir,
          workDir: tempDir,
          outputDir: path.join(tempDir, "output"),
        },
        undefined,
        emitter
      )).rejects.toThrow();

      expect(events.some((e: any) => e.type === "error")).toBe(true);
    });

    it("works without emitter (backward compatibility)", async () => {
      const strategy = new DockerfileBuildStrategy();
      await fs.writeFile(path.join(tempDir, "Dockerfile"), "FROM node:20");

      const result = await strategy.build(
        {
          projectId: "test-project",
          deploymentId: "test-deployment",
          sourceDir: tempDir,
          workDir: tempDir,
          outputDir: path.join(tempDir, "output"),
        },
        undefined
        // No emitter
      );

      expect(result.success).toBe(true);
    });
  });

  describe("NodeJsBuildStrategy", () => {
    it("emits progress events during build", async () => {
      const strategy = new NodeJsBuildStrategy();
      await fs.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "test", dependencies: { express: "^4.0.0" } })
      );

      const emitter = new EventEmitter();
      const events: unknown[] = [];

      emitter.on("progress", (data: BuildProgressEvent) => events.push(data));

      const result = await strategy.build(
        {
          projectId: "test-project",
          deploymentId: "test-deployment",
          sourceDir: tempDir,
          workDir: tempDir,
          outputDir: path.join(tempDir, "output"),
        },
        undefined,
        emitter
      );

      expect(result.success).toBe(true);
      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e: any) => e.type === "complete")).toBe(true);
    });

    it("works without emitter (backward compatibility)", async () => {
      const strategy = new NodeJsBuildStrategy();
      await fs.writeFile(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "test", dependencies: { express: "^4.0.0" } })
      );

      const result = await strategy.build(
        {
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
      // Empty registry

      await expect(registry.detect({
        projectId: "test",
        deploymentId: "test",
        sourceDir: tempDir,
        workDir: tempDir,
        outputDir: path.join(tempDir, "output"),
      })).rejects.toThrow("No build strategy available");
    });
  });
});
