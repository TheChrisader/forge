/**
 * Nixpacks build strategy tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NixpacksBuildStrategy } from "../strategies/nixpacks.strategy.js";
import type { BuildContext, BuildProgressEvent } from "../interfaces/strategy.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Image } from "@forge/database";

// Mock fs and path
vi.mock("node:fs/promises");
vi.mock("node:path");

// Mock DockerRuntime - we'll test the actual Docker integration in integration tests
vi.mock("@forge/docker", () => ({
  DockerRuntime: class {
    async create(_config: unknown): Promise<{ id: string }> {
      return Promise.resolve({ id: "test-container-id" });
    }
    async start(_id: string): Promise<void> {}
    async *logs(_id: string, _options: unknown): AsyncGenerator<BuildProgressEvent> {
      yield Promise.resolve({
        type: "stage" as const,
        timestamp: new Date(),
        stream: "stdout" as const,
        message: "Building...",
      });
      yield Promise.resolve({
        type: "stage" as const,
        timestamp: new Date(),
        stream: "stdout" as const,
        message: "Done!",
      });
    }
    async waitForState(_id: string, _state: string, _options?: unknown): Promise<void> {}
    async listImages(_filters?: unknown): Promise<Partial<Image>[]> {
      return Promise.resolve([{ id: "sha256:test123", repoTags: ["forge/test:dep1"] }]);
    }
  },
}));

describe("NixpacksBuildStrategy", () => {
  let strategy: NixpacksBuildStrategy;
  let mockContext: BuildContext;

  beforeEach(() => {
    strategy = new NixpacksBuildStrategy();
    mockContext = {
      projectId: "test-project",
      projectName: "test-project",
      deploymentId: "test-dep",
      sourceDir: "/tmp/test-source",
      workDir: "/tmp/forge-builds",
      outputDir: "/tmp/forge-builds/test-dep/output",
    };

    vi.clearAllMocks();
  });

  describe("name", () => {
    it("should have correct name", () => {
      expect(strategy.name).toBe("nixpacks");
    });
  });

  describe("detect", () => {
    it("should detect with high confidence when nixpacks.toml exists", async () => {
      const mockFs = vi.mocked(fs);
      const mockPath = vi.mocked(path);

      mockPath.join.mockReturnValue("/tmp/test-source/nixpacks.toml");
      mockFs.access.mockResolvedValue(undefined);

      const result = await strategy.detect(mockContext);

      expect(result.detected).toBe(true);
      expect(result.confidence).toBe(0.9);
      expect(result.framework).toBe("nixpacks");
      expect(result.discoveredScripts?.source).toBe("nixpacks.toml");
    });

    it("should detect with medium confidence for generic projects", async () => {
      const mockFs = vi.mocked(fs);
      const mockPath = vi.mocked(path);

      // First call: nixpacks.toml doesn't exist
      mockFs.access.mockRejectedValueOnce(new Error("not found"));
      // Second call: package.json exists
      mockFs.access.mockResolvedValueOnce(undefined);
      mockPath.join.mockImplementation((dir: string, file: string) => {
        if (file === "nixpacks.toml") return "/tmp/test-source/nixpacks.toml";
        if (file === "package.json") return "/tmp/test-source/package.json";
        return `${dir}/${file}`;
      });

      const result = await strategy.detect(mockContext);

      expect(result.detected).toBe(true);
      expect(result.confidence).toBe(0.75);
      expect(result.framework).toBe("generic");
      expect(result.discoveredScripts?.source).toBe("generic-detection");
    });

    it("should not detect empty projects", async () => {
      const mockFs = vi.mocked(fs);
      const mockPath = vi.mocked(path);

      mockPath.join.mockReturnValue("/tmp/test-source/nixpacks.toml");
      mockFs.access.mockRejectedValue(new Error("not found"));

      const result = await strategy.detect(mockContext);

      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it("should detect various generic project indicators", async () => {
      const mockFs = vi.mocked(fs);
      const mockPath = vi.mocked(path);

      // nixpacks.toml doesn't exist
      mockFs.access.mockRejectedValueOnce(new Error("not found"));
      // go.mod exists
      mockFs.access.mockResolvedValueOnce(undefined);

      mockPath.join.mockImplementation((dir: string, file: string) => {
        return `${dir}/${file}`;
      });

      const result = await strategy.detect(mockContext);

      expect(result.detected).toBe(true);
      expect(result.confidence).toBe(0.75);
    });
  });

  describe("getDefaultConfig", () => {
    it("should return default config", () => {
      const config = strategy.getDefaultConfig();

      expect(config.nixpacksImage).toBe("forge/nixpacks-builder:local");
      expect(config.nixpacksArgs).toEqual([]);
    });
  });

  describe("validateConfig", () => {
    it("should accept valid config with image tag", () => {
      const result = strategy.validateConfig({
        nixpacksImage: "forge/nixpacks-builder:v1.0.0",
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it("should accept config with default nixpacks image", () => {
      const result = strategy.validateConfig({
        nixpacksImage: "forge/nixpacks-builder:local",
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it("should reject config without image tag", () => {
      const result = strategy.validateConfig({
        nixpacksImage: "forge/nixpacks-builder",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "nixpacksImage must include a tag (e.g., 'forge/nixpacks-builder:local')"
      );
    });

    it("should accept config without nixpacksImage", () => {
      const result = strategy.validateConfig({});

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });
});
