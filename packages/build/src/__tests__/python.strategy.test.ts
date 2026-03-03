/**
 * Python build strategy tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PythonBuildStrategy } from "../strategies/python.strategy.js";
import type { BuildContext } from "../interfaces/strategy.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { PathLike } from "node:fs";

// Mock fs
vi.mock("node:fs/promises");
vi.mock("node:path");

describe("PythonBuildStrategy", () => {
  let strategy: PythonBuildStrategy;
  let mockContext: BuildContext;

  beforeEach(() => {
    strategy = new PythonBuildStrategy();
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
    it("should detect FastAPI project", async () => {
      const mockFs = vi.mocked(fs);
      const mockPath = vi.mocked(path);

      mockPath.join.mockImplementation((dir: string, file: string) => {
        if (file === "requirements.txt") return "/tmp/source/requirements.txt";
        return `${dir}/${file}`;
      });

      mockFs.access.mockImplementation((filePath: PathLike) => {
        if (filePath.toString() === "/tmp/source/requirements.txt") {
          return Promise.resolve();
        }
        return Promise.reject(new Error("File not found"));
      });

      mockFs.readFile.mockResolvedValue("fastapi\nuvicorn\n");

      const result = await strategy.detect(mockContext);

      expect(result.detected).toBe(true);
      expect(result.framework).toBe("FastAPI");
      expect(result.confidence).toBe(0.9);
      expect(result.config?.installCommand).toBe("pip install -r requirements.txt");
      expect(result.config?.startCommand).toContain("uvicorn");
      expect(result.config?.port).toBe(8000);
    });

    it("should detect Django project", async () => {
      const mockFs = vi.mocked(fs);
      const mockPath = vi.mocked(path);

      mockPath.join.mockImplementation((dir: string, file: string) => {
        if (file === "requirements.txt") return "/tmp/source/requirements.txt";
        return `${dir}/${file}`;
      });

      mockFs.access.mockImplementation((filePath: PathLike) => {
        if (filePath.toString() === "/tmp/source/requirements.txt") {
          return Promise.resolve();
        }
        return Promise.reject(new Error("File not found"));
      });

      mockFs.readFile.mockResolvedValue("django\ndjangorestframework\n");

      const result = await strategy.detect(mockContext);

      expect(result.detected).toBe(true);
      expect(result.framework).toBe("Django");
      expect(result.confidence).toBe(0.9);
    });

    it("should detect Flask project", async () => {
      const mockFs = vi.mocked(fs);
      const mockPath = vi.mocked(path);

      mockPath.join.mockImplementation((dir: string, file: string) => {
        if (file === "requirements.txt") return "/tmp/source/requirements.txt";
        return `${dir}/${file}`;
      });

      mockFs.access.mockImplementation((filePath: PathLike) => {
        if (filePath.toString() === "/tmp/source/requirements.txt") {
          return Promise.resolve();
        }
        return Promise.reject(new Error("File not found"));
      });

      mockFs.readFile.mockResolvedValue("Flask\nWerkzeug\n");

      const result = await strategy.detect(mockContext);

      expect(result.detected).toBe(true);
      expect(result.framework).toBe("Flask");
      expect(result.confidence).toBe(0.85);
      expect(result.config?.port).toBe(5000);
    });

    it("should detect generic Python project from requirements.txt", async () => {
      const mockFs = vi.mocked(fs);
      const mockPath = vi.mocked(path);

      mockPath.join.mockImplementation((dir: string, file: string) => {
        if (file === "requirements.txt") return "/tmp/source/requirements.txt";
        return `${dir}/${file}`;
      });

      mockFs.access.mockImplementation((filePath: PathLike) => {
        if (filePath.toString() === "/tmp/source/requirements.txt") {
          return Promise.resolve();
        }
        return Promise.reject(new Error("File not found"));
      });

      mockFs.readFile.mockResolvedValue("requests\nclick\n");

      const result = await strategy.detect(mockContext);

      expect(result.detected).toBe(true);
      expect(result.framework).toBe("Python");
      expect(result.confidence).toBe(0.7);
    });

    it("should detect Python project from pyproject.toml", async () => {
      const mockFs = vi.mocked(fs);
      const mockPath = vi.mocked(path);

      mockPath.join.mockImplementation((dir: string, file: string) => {
        if (file === "pyproject.toml") return "/tmp/source/pyproject.toml";
        return `${dir}/${file}`;
      });

      mockFs.access.mockImplementation((filePath: PathLike) => {
        if (filePath.toString() === "/tmp/source/pyproject.toml") {
          return Promise.resolve();
        }
        return Promise.reject(new Error("File not found"));
      });

      mockFs.readFile.mockResolvedValue('[tool.poetry]\nname = "my-project"\n');

      const result = await strategy.detect(mockContext);

      expect(result.detected).toBe(true);
      expect(result.framework).toBe("Python");
      expect(result.confidence).toBe(0.7);
    });

    it("should not detect non-Python project", async () => {
      const mockFs = vi.mocked(fs);
      const mockPath = vi.mocked(path);

      mockPath.join.mockReturnValue("/tmp/source/requirements.txt");

      mockFs.access.mockRejectedValue(new Error("File not found"));

      const result = await strategy.detect(mockContext);

      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
    });
  });

  describe("getDefaultConfig", () => {
    it("should return default config", () => {
      const config = strategy.getDefaultConfig();

      expect(config.pythonVersion).toBe("3.11");
      expect(config.installCommand).toBe("pip install -r requirements.txt");
      expect(config.startCommand).toBe("python main.py");
      expect(config.port).toBe(8000);
    });
  });

  describe("validateConfig", () => {
    it("should validate valid config", () => {
      const result = strategy.validateConfig({
        installCommand: "pip install -r requirements.txt",
        startCommand: "python main.py",
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it("should return errors for missing installCommand", () => {
      const result = strategy.validateConfig({
        startCommand: "python main.py",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("installCommand is required");
    });

    it("should return errors for missing startCommand", () => {
      const result = strategy.validateConfig({
        installCommand: "pip install -r requirements.txt",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("startCommand is required");
    });
  });
});
