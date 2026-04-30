import { describe, it, expect, vi, beforeEach } from "vitest";
import { DockerfileBuildStrategy } from "../strategies/dockerfile.strategy.js";
import type { BuildContext } from "../interfaces/strategy.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";

// Mock fs
vi.mock("node:fs/promises");
vi.mock("node:path");

describe("DockerfileBuildStrategy", () => {
  let strategy: DockerfileBuildStrategy;
  let mockContext: BuildContext;

  beforeEach(() => {
    strategy = new DockerfileBuildStrategy();
    mockContext = {
      projectId: "test-project",
      projectName: "test-project",
      deploymentId: "test-deployment",
      workDir: "/tmp/build",
      sourceDir: "/tmp/source",
      outputDir: "/tmp/output",
    };

    vi.clearAllMocks();
  });

  describe("detect", () => {
    it("should detect Dockerfile exists", async () => {
      const mockFs = vi.mocked(fs);
      const mockPath = vi.mocked(path);

      mockPath.join.mockReturnValue("/tmp/source/Dockerfile");
      mockFs.access.mockResolvedValue(undefined);

      const result = await strategy.detect(mockContext);

      expect(result.detected).toBe(true);
      expect(result.framework).toBe("docker");
      expect(result.confidence).toBe(1);
    });

    it("should not detect when Dockerfile missing", async () => {
      const mockFs = vi.mocked(fs);
      const mockPath = vi.mocked(path);

      mockPath.join.mockReturnValue("/tmp/source/Dockerfile");
      mockFs.access.mockRejectedValue(new Error("File not found"));

      const result = await strategy.detect(mockContext);

      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
    });
  });

  describe("getDefaultConfig", () => {
    it("should return default config", () => {
      const config = strategy.getDefaultConfig();

      expect(config.dockerfile).toBe("Dockerfile");
    });
  });

  describe("validateConfig", () => {
    it("should validate valid config", () => {
      const result = strategy.validateConfig({
        dockerfile: "Dockerfile",
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it("should return errors for missing dockerfile", () => {
      const result = strategy.validateConfig({});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("dockerfile path is required");
    });
  });
});
