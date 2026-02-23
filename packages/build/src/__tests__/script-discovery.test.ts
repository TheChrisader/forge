/**
 * Tests for script discovery utilities
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  parsePackageJsonScripts,
  discoverNodeJSScripts,
  discoverPythonScripts,
  discoverGoScripts,
  discoverScripts,
  findBestScriptMatch,
  getEnvironmentScriptVariants,
  analyzeDiscoveredScripts,
} from "../utils/script-discovery.js";

describe("script-discovery", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "script-discovery-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("parsePackageJsonScripts", () => {
    it("should parse package.json and extract scripts", async () => {
      const packageJsonPath = path.join(tempDir, "package.json");
      const content = {
        name: "test-project",
        scripts: {
          build: "vite build",
          start: "vite preview",
          test: "vitest",
        },
      };
      await fs.writeFile(packageJsonPath, JSON.stringify(content, null, 2));

      const result = await parsePackageJsonScripts(packageJsonPath);

      expect(result.build).toBe("vite build");
      expect(result.start).toBe("vite preview");
      expect(result.all).toEqual({
        build: "vite build",
        start: "vite preview",
        test: "vitest",
      });
      expect(result.sourcePath).toBe(packageJsonPath);
    });

    it("should handle package.json without scripts", async () => {
      const packageJsonPath = path.join(tempDir, "package.json");
      const content = { name: "test-project" };
      await fs.writeFile(packageJsonPath, JSON.stringify(content, null, 2));

      const result = await parsePackageJsonScripts(packageJsonPath);

      expect(result.build).toBeUndefined();
      expect(result.start).toBeUndefined();
      expect(result.all).toEqual({});
    });

    it("should handle package.json with install scripts", async () => {
      const packageJsonPath = path.join(tempDir, "package.json");
      const content = {
        name: "test-project",
        scripts: {
          preinstall: "npx only-allow pnpm",
          postinstall: "node scripts/postinstall.js",
        },
      };
      await fs.writeFile(packageJsonPath, JSON.stringify(content, null, 2));

      const result = await parsePackageJsonScripts(packageJsonPath);

      expect(result.install).toBe("npx only-allow pnpm");
    });

    it("should throw error for non-existent package.json", async () => {
      const packageJsonPath = path.join(tempDir, "nonexistent.json");

      await expect(parsePackageJsonScripts(packageJsonPath)).rejects.toThrow("not found");
    });

    it("should throw error for invalid JSON", async () => {
      const packageJsonPath = path.join(tempDir, "package.json");
      await fs.writeFile(packageJsonPath, "{ invalid json }");

      await expect(parsePackageJsonScripts(packageJsonPath)).rejects.toThrow("Invalid JSON");
    });
  });

  describe("findBestScriptMatch", () => {
    it("should find first available match in patterns", () => {
      const available = ["build", "start", "test"];
      const patterns = ["build:prod", "build"];

      const result = findBestScriptMatch(available, patterns);

      // Returns "build" since "build:prod" is not available
      expect(result).toBe("build");
    });

    it("should find fallback match", () => {
      const available = ["build", "start"];
      const patterns = ["build:prod", "build"];

      const result = findBestScriptMatch(available, patterns);

      expect(result).toBe("build");
    });

    it("should return undefined when no match found", () => {
      const available = ["start", "test"];
      const patterns = ["build:prod", "build"];

      const result = findBestScriptMatch(available, patterns);

      expect(result).toBeUndefined();
    });
  });

  describe("getEnvironmentScriptVariants", () => {
    it("should return environment-specific variants first", () => {
      const variants = getEnvironmentScriptVariants("build", "production");

      // Should contain production variants
      expect(variants).toContain("build:production");
      expect(variants).toContain("build:prod");
      expect(variants).toContain("build");
    });

    it("should handle staging environment", () => {
      const variants = getEnvironmentScriptVariants("build", "staging");

      expect(variants[0]).toBe("build:staging");
    });

    it("should handle no environment", () => {
      const variants = getEnvironmentScriptVariants("build");

      expect(variants).toEqual(["build", "build:prod", "build:production"]);
    });
  });

  describe("discoverNodeJSScripts", () => {
    it("should discover scripts from package.json", async () => {
      const packageJsonPath = path.join(tempDir, "package.json");
      const content = {
        name: "test-project",
        scripts: {
          build: "vite build",
          start: "vite preview",
        },
      };
      await fs.writeFile(packageJsonPath, JSON.stringify(content, null, 2));

      const result = await discoverNodeJSScripts(tempDir);

      expect(result).not.toBeNull();
      expect(result?.build).toBe("vite build");
      expect(result?.start).toBe("vite preview");
      expect(result?.source).toBe("package.json");
    });

    it("should handle framework-specific script discovery", async () => {
      const packageJsonPath = path.join(tempDir, "package.json");
      const content = {
        name: "test-project",
        scripts: {
          "build:prod": "vite build --mode production",
          "start:server": "node server.js",
        },
      };
      await fs.writeFile(packageJsonPath, JSON.stringify(content, null, 2));

      const result = await discoverNodeJSScripts(tempDir, { framework: "vite" });

      expect(result).not.toBeNull();
      // Vite pattern includes "build" which would match if available
      expect(result?.source).toBe("package.json");
    });

    it("should return null when no package.json exists", async () => {
      const result = await discoverNodeJSScripts(tempDir);

      expect(result).toBeNull();
    });
  });

  describe("discoverPythonScripts", () => {
    it("should discover scripts from requirements.txt", async () => {
      const requirementsPath = path.join(tempDir, "requirements.txt");
      await fs.writeFile(requirementsPath, "fastapi==0.104.0\nuvicorn==0.24.0");

      const result = await discoverPythonScripts(tempDir);

      expect(result).not.toBeNull();
      expect(result?.install).toBe("pip install -r requirements.txt");
      expect(result?.source).toBe("requirements.txt");
    });

    it("should prefer requirements.txt over pyproject.toml", async () => {
      const requirementsPath = path.join(tempDir, "requirements.txt");
      const pyprojectPath = path.join(tempDir, "pyproject.toml");

      await fs.writeFile(requirementsPath, "fastapi==0.104.0");
      await fs.writeFile(pyprojectPath, "[project]\nname = 'test'");

      const result = await discoverPythonScripts(tempDir);

      expect(result?.source).toBe("requirements.txt");
    });

    it("should discover from pyproject.toml when no requirements.txt", async () => {
      const pyprojectPath = path.join(tempDir, "pyproject.toml");
      await fs.writeFile(pyprojectPath, "[project]\nname = 'test'");

      const result = await discoverPythonScripts(tempDir);

      expect(result).not.toBeNull();
      expect(result?.install).toBe("pip install -e .");
      expect(result?.source).toBe("pyproject.toml");
    });

    it("should return null when no Python files exist", async () => {
      const result = await discoverPythonScripts(tempDir);

      expect(result).toBeNull();
    });
  });

  describe("discoverGoScripts", () => {
    it("should discover scripts from go.mod", async () => {
      const goModPath = path.join(tempDir, "go.mod");
      await fs.writeFile(goModPath, "module example.com/test\n\ngo 1.21");

      const result = await discoverGoScripts(tempDir);

      expect(result).not.toBeNull();
      expect(result?.install).toBe("go mod download");
      expect(result?.build).toBe("go build -o app");
      expect(result?.start).toBe("./app");
      expect(result?.source).toBe("go.mod");
    });

    it("should return null when no go.mod exists", async () => {
      const result = await discoverGoScripts(tempDir);

      expect(result).toBeNull();
    });
  });

  describe("discoverScripts", () => {
    it("should discover Node.js scripts when package.json exists", async () => {
      const packageJsonPath = path.join(tempDir, "package.json");
      const content = {
        name: "test-project",
        scripts: { build: "vite build" },
      };
      await fs.writeFile(packageJsonPath, JSON.stringify(content, null, 2));

      const result = await discoverScripts(tempDir);

      expect(result?.source).toBe("package.json");
    });

    it("should discover Python scripts when requirements.txt exists", async () => {
      const requirementsPath = path.join(tempDir, "requirements.txt");
      await fs.writeFile(requirementsPath, "fastapi==0.104.0");

      const result = await discoverScripts(tempDir);

      expect(result?.source).toBe("requirements.txt");
    });

    it("should discover Go scripts when go.mod exists", async () => {
      const goModPath = path.join(tempDir, "go.mod");
      await fs.writeFile(goModPath, "module test");

      const result = await discoverScripts(tempDir);

      expect(result?.source).toBe("go.mod");
    });

    it("should return null when no manifest files exist", async () => {
      const result = await discoverScripts(tempDir);

      expect(result).toBeNull();
    });
  });

  describe("analyzeDiscoveredScripts", () => {
    it("should analyze discovered scripts and report missing", () => {
      const discovered = {
        build: "npm run build",
        start: undefined,
        install: "npm ci",
        all: { build: "npm run build", test: "jest" },
        source: "package.json",
        sourcePath: "/path/to/package.json",
      };

      const result = analyzeDiscoveredScripts(discovered, ["build", "start", "install"]);

      expect(result.available).toEqual(["build", "test"]);
      expect(result.missing).toEqual(["start"]);
    });

    it("should handle null discovered scripts", () => {
      const result = analyzeDiscoveredScripts(null, ["build", "start"]);

      expect(result.available).toEqual([]);
      expect(result.missing).toEqual(["build", "start"]);
    });

    it("should handle no missing scripts", () => {
      const discovered = {
        build: "npm run build",
        start: "npm start",
        all: { build: "npm run build", start: "npm start" },
        source: "package.json",
        sourcePath: "/path/to/package.json",
      };

      const result = analyzeDiscoveredScripts(discovered, ["build", "start"]);

      expect(result.available).toEqual(["build", "start"]);
      expect(result.missing).toEqual([]);
    });
  });
});
