/**
 * Node.js build strategy tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NodeJsBuildStrategy } from "../strategies/nodejs.strategy.js";
import type { BuildContext } from "../interfaces/strategy.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";

// Mock fs
vi.mock("node:fs/promises");
vi.mock("node:path");

describe("NodeJsBuildStrategy", () => {
  let strategy: NodeJsBuildStrategy;
  let mockContext: BuildContext;

  beforeEach(() => {
    strategy = new NodeJsBuildStrategy();
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
    it("should detect Next.js project", async () => {
      const mockPath = vi.mocked(path);
      const mockFs = vi.mocked(fs);

      mockPath.join.mockReturnValue("/tmp/source/package.json");
      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
          dependencies: {
            next: "^14.0.0",
            react: "^18.0.0",
          },
          scripts: {
            build: "npm run build",
            start: "npm start",
          },
        })
      );

      const result = await strategy.detect(mockContext);

      expect(result.detected).toBe(true);
      expect(result.framework).toBe("Next.js");
      expect(result.confidence).toBe(0.95);
      expect(result.config?.installCommand).toBe("npm ci");
      expect(result.config?.buildCommand).toBe("npm run build");
      expect(result.config?.startCommand).toBe("npm start");
      expect(result.config?.port).toBe(3000);
    });

    it("should detect Vite project", async () => {
      const mockFs = vi.mocked(fs);
      const mockPath = vi.mocked(path);

      mockPath.join.mockReturnValue("/tmp/source/package.json");
      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
          dependencies: {
            vite: "^5.0.0",
          },
        })
      );

      const result = await strategy.detect(mockContext);

      expect(result.detected).toBe(true);
      expect(result.framework).toBe("Vite");
      expect(result.confidence).toBe(0.88);
    });

    it("should detect NestJS project", async () => {
      const mockFs = vi.mocked(fs);
      const mockPath = vi.mocked(path);

      mockPath.join.mockReturnValue("/tmp/source/package.json");
      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
          dependencies: {
            "@nestjs/core": "^10.0.0",
          },
        })
      );

      const result = await strategy.detect(mockContext);

      expect(result.detected).toBe(true);
      expect(result.framework).toBe("NestJS");
      expect(result.confidence).toBe(0.9);
      expect(result.config?.startCommand).toBe("node dist/main.js");
    });

    it("should detect Express project", async () => {
      const mockFs = vi.mocked(fs);
      const mockPath = vi.mocked(path);

      mockPath.join.mockReturnValue("/tmp/source/package.json");
      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
          dependencies: {
            express: "^4.18.0",
          },
        })
      );

      const result = await strategy.detect(mockContext);

      expect(result.detected).toBe(true);
      expect(result.framework).toBe("Express");
      expect(result.confidence).toBe(0.7);
    });

    it("should detect React project", async () => {
      const mockFs = vi.mocked(fs);
      const mockPath = vi.mocked(path);

      mockPath.join.mockReturnValue("/tmp/source/package.json");
      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
          dependencies: {
            react: "^18.0.0",
            "react-dom": "^18.0.0",
          },
        })
      );

      const result = await strategy.detect(mockContext);

      expect(result.detected).toBe(true);
      expect(result.framework).toBe("React");
      expect(result.confidence).toBe(0.65);
    });

    it("should detect generic Node.js project", async () => {
      const mockFs = vi.mocked(fs);
      const mockPath = vi.mocked(path);

      mockPath.join.mockReturnValue("/tmp/source/package.json");
      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
          dependencies: {
            lodash: "^4.17.0",
          },
        })
      );

      const result = await strategy.detect(mockContext);

      expect(result.detected).toBe(true);
      expect(result.framework).toBe("Node.js");
      expect(result.confidence).toBe(0.6);
    });

    it("should not detect non-Node.js project", async () => {
      const mockFs = vi.mocked(fs);
      const mockPath = vi.mocked(path);

      mockPath.join.mockReturnValue("/tmp/source/package.json");
      mockFs.readFile.mockRejectedValue(new Error("File not found"));

      const result = await strategy.detect(mockContext);

      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it("should extract version correctly", async () => {
      const mockFs = vi.mocked(fs);
      const mockPath = vi.mocked(path);

      mockPath.join.mockReturnValue("/tmp/source/package.json");
      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
          dependencies: {
            next: "^14.2.5",
          },
        })
      );

      const result = await strategy.detect(mockContext);

      expect(result.version).toBe("14.2.5");
    });
  });

  describe("getDefaultConfig", () => {
    it("should return default config", () => {
      const config = strategy.getDefaultConfig();

      expect(config.nodeVersion).toBe("20");
      expect(config.installCommand).toBe("npm ci");
      expect(config.buildCommand).toBe("npm run build");
      expect(config.startCommand).toBe("npm start");
      expect(config.port).toBe(3000);
    });
  });

  describe("validateConfig", () => {
    it("should validate valid config", () => {
      const result = strategy.validateConfig({
        installCommand: "npm ci",
        startCommand: "npm start",
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it("should return errors for missing installCommand when autoDiscoverScripts is false", () => {
      const result = strategy.validateConfig({
        startCommand: "npm start",
        autoDiscoverScripts: false,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("installCommand is required when autoDiscoverScripts is false");
    });

    it("should return errors for missing startCommand when autoDiscoverScripts is false", () => {
      const result = strategy.validateConfig({
        installCommand: "npm ci",
        autoDiscoverScripts: false,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("startCommand is required when autoDiscoverScripts is false");
    });
  });
});
