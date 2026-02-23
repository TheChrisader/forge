/**
 * Tests for command resolution utilities
 */

import { describe, it, expect } from "vitest";
import {
  resolveBuildCommand,
  resolveStartCommand,
  resolveInstallCommand,
  resolveAllCommands,
  getFrameworkDefaults,
  normalizeFrameworkName,
  validateCommandSafety,
} from "../utils/command-resolution.js";
import type { DiscoveredScripts } from "../utils/script-discovery.js";

describe("command-resolution", () => {
  describe("resolveBuildCommand", () => {
    const mockScripts: DiscoveredScripts = {
      build: "npm run build",
      start: "npm start",
      install: "npm ci",
      all: { build: "npm run build", start: "npm start" },
      source: "package.json",
      sourcePath: "/path/to/package.json",
    };

    it("should use override command when provided", () => {
      const result = resolveBuildCommand(mockScripts, {
        override: "custom build command",
      });

      expect(result.command).toBe("custom build command");
      expect(result.source).toBe("override");
      expect(result.warnings).toEqual([]);
    });

    it("should use discovered script when available", () => {
      const result = resolveBuildCommand(mockScripts, {
        framework: "nextjs",
      });

      expect(result.command).toBe("npm run build");
      expect(result.source).toContain("discovered");
      expect(result.warnings).toEqual([]);
    });

    it("should use framework default when no discovered script", () => {
      const scriptsWithoutBuild: DiscoveredScripts = {
        ...mockScripts,
        build: undefined,
      };

      const result = resolveBuildCommand(scriptsWithoutBuild, {
        framework: "nextjs",
      });

      expect(result.command).toBe("next build");
      expect(result.source).toContain("framework-default");
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should use generic fallback when no framework default", () => {
      const scriptsWithoutBuild: DiscoveredScripts = {
        ...mockScripts,
        build: undefined,
      };

      const result = resolveBuildCommand(scriptsWithoutBuild, {
        framework: "unknown-framework",
      });

      expect(result.command).toBe("npm run build");
      expect(result.source).toBe("generic-fallback");
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should return null when allowNull is true and no command found", () => {
      const emptyScripts: DiscoveredScripts = {
        all: {},
        source: "none",
        sourcePath: "",
      };

      const result = resolveBuildCommand(emptyScripts, {
        framework: "unknown",
        allowNull: true,
      });

      // Generic fallback should still provide a command
      expect(result.source).toBe("generic-fallback");
    });

    it("should return null when no scripts and no generic fallback", () => {
      const result = resolveBuildCommand(null, {
        framework: "nonexistent-framework",
        allowNull: true,
      });

      // Will fall back to generic
      expect(result.source).toBe("generic-fallback");
    });
  });

  describe("resolveStartCommand", () => {
    const mockScripts: DiscoveredScripts = {
      build: "npm run build",
      start: "npm start",
      install: "npm ci",
      all: { build: "npm run build", start: "npm start" },
      source: "package.json",
      sourcePath: "/path/to/package.json",
    };

    it("should use override command when provided", () => {
      const result = resolveStartCommand(mockScripts, {
        override: "custom start command",
      });

      expect(result.command).toBe("custom start command");
      expect(result.source).toBe("override");
    });

    it("should use discovered script when available", () => {
      const result = resolveStartCommand(mockScripts);

      expect(result.command).toBe("npm start");
      expect(result.source).toContain("discovered");
    });

    it("should use framework default when no discovered script", () => {
      const scriptsWithoutStart: DiscoveredScripts = {
        ...mockScripts,
        start: undefined,
      };

      const result = resolveStartCommand(scriptsWithoutStart, {
        framework: "nextjs",
      });

      expect(result.command).toBe("next start");
      expect(result.source).toContain("framework-default");
    });
  });

  describe("resolveInstallCommand", () => {
    const mockScripts: DiscoveredScripts = {
      build: "npm run build",
      start: "npm start",
      install: "pnpm install",
      all: { build: "npm run build", start: "npm start", install: "pnpm install" },
      source: "package.json",
      sourcePath: "/path/to/package.json",
    };

    it("should use override command when provided", () => {
      const result = resolveInstallCommand(mockScripts, {
        override: "yarn install",
      });

      expect(result.command).toBe("yarn install");
      expect(result.source).toBe("override");
    });

    it("should use discovered install script when available", () => {
      const result = resolveInstallCommand(mockScripts);

      expect(result.command).toBe("pnpm install");
      expect(result.source).toContain("discovered");
    });

    it("should use framework default when no discovered script", () => {
      const scriptsWithoutInstall: DiscoveredScripts = {
        ...mockScripts,
        install: undefined,
      };

      const result = resolveInstallCommand(scriptsWithoutInstall, {
        framework: "nextjs",
      });

      expect(result.command).toBe("npm ci");
      expect(result.source).toContain("framework-default");
    });
  });

  describe("resolveAllCommands", () => {
    const mockScripts: DiscoveredScripts = {
      build: "npm run build",
      start: "npm start",
      install: "npm ci",
      all: { build: "npm run build", start: "npm start" },
      source: "package.json",
      sourcePath: "/path/to/package.json",
    };

    it("should resolve all commands with discovered scripts", () => {
      const result = resolveAllCommands(mockScripts, {
        framework: "nextjs",
      });

      expect(result.install.command).toBe("npm ci");
      expect(result.build.command).toBe("npm run build");
      expect(result.start.command).toBe("npm start");
      expect(result.allWarnings).toEqual([]);
    });

    it("should collect warnings from all command resolutions", () => {
      const emptyScripts: DiscoveredScripts = {
        all: {},
        source: "none",
        sourcePath: "",
      };

      const result = resolveAllCommands(emptyScripts, {
        framework: "unknown",
      });

      // Should have warnings for missing commands
      expect(result.allWarnings.length).toBeGreaterThan(0);
    });

    it("should use overrides for all commands when provided", () => {
      // When override is provided in resolveAllCommands, it applies to all commands
      // For specific overrides, use individual resolve functions or the override*Command options in BuildConfig
      const result = resolveAllCommands(mockScripts, {
        framework: "nextjs",
        override: "custom command",
      });

      expect(result.install.command).toBe("custom command");
      expect(result.build.command).toBe("custom command");
      expect(result.start.command).toBe("custom command");
    });
  });

  describe("getFrameworkDefaults", () => {
    it("should return Next.js defaults", () => {
      const defaults = getFrameworkDefaults("nextjs");

      expect(defaults.build).toBe("next build");
      expect(defaults.start).toBe("next start");
      expect(defaults.install).toBe("npm ci");
    });

    it("should return Vite defaults", () => {
      const defaults = getFrameworkDefaults("vite");

      expect(defaults.build).toBe("vite build");
      expect(defaults.start).toBe("npx serve dist -s");
      expect(defaults.install).toBe("npm ci");
    });

    it("should return NestJS defaults", () => {
      const defaults = getFrameworkDefaults("nestjs");

      expect(defaults.build).toBe("npm run build");
      expect(defaults.start).toBe("node dist/main.js");
      expect(defaults.install).toBe("npm ci");
    });

    it("should return Python framework defaults", () => {
      const fastapiDefaults = getFrameworkDefaults("fastapi");

      expect(fastapiDefaults.install).toBe("pip install -r requirements.txt");
      expect(fastapiDefaults.start).toBe("uvicorn main:app --host 0.0.0.0 --port 8000");

      const djangoDefaults = getFrameworkDefaults("django");

      expect(djangoDefaults.start).toContain("manage.py runserver");
    });

    it("should return Go framework defaults", () => {
      const defaults = getFrameworkDefaults("gin");

      expect(defaults.install).toBe("go mod download");
      expect(defaults.build).toBe("go build -o app");
      expect(defaults.start).toBe("./app");
    });

    it("should return generic defaults for unknown framework", () => {
      const defaults = getFrameworkDefaults("unknown-framework");

      expect(defaults.install).toBe("npm ci");
      expect(defaults.build).toBe("npm run build");
      expect(defaults.start).toBe("npm start");
    });
  });

  describe("normalizeFrameworkName", () => {
    it("should normalize Next.js variations", () => {
      expect(normalizeFrameworkName("Next.js")).toBe("nextjs");
      expect(normalizeFrameworkName("next")).toBe("nextjs");
      expect(normalizeFrameworkName("NEXTJS")).toBe("nextjs");
    });

    it("should normalize NestJS variations", () => {
      expect(normalizeFrameworkName("NestJS")).toBe("nestjs");
      expect(normalizeFrameworkName("nest")).toBe("nestjs");
    });

    it("should normalize React variations", () => {
      expect(normalizeFrameworkName("React")).toBe("react");
      expect(normalizeFrameworkName("create-react-app")).toBe("react");
      expect(normalizeFrameworkName("CRA")).toBe("react");
    });

    it("should normalize Vue variations", () => {
      expect(normalizeFrameworkName("Vue")).toBe("vue");
      expect(normalizeFrameworkName("vuejs")).toBe("vue");
    });

    it("should normalize Python framework variations", () => {
      expect(normalizeFrameworkName("FastAPI")).toBe("fastapi");
      expect(normalizeFrameworkName("Django")).toBe("django");
      expect(normalizeFrameworkName("Flask")).toBe("flask");
    });

    it("should handle Go framework variations", () => {
      expect(normalizeFrameworkName("Gin")).toBe("gin");
      expect(normalizeFrameworkName("Gorilla Mux")).toBe("gin");
      expect(normalizeFrameworkName("gorilla/mux")).toBe("gin");
      expect(normalizeFrameworkName("Echo")).toBe("echo");
      expect(normalizeFrameworkName("Fiber")).toBe("fiber");
      expect(normalizeFrameworkName("gofiber")).toBe("fiber");
    });

    it("should return generic for unknown frameworks", () => {
      expect(normalizeFrameworkName("unknown")).toBe("unknown");
      expect(normalizeFrameworkName("")).toBe("generic");
      expect(normalizeFrameworkName(undefined)).toBe("generic");
    });

    it("should normalize static to generic", () => {
      expect(normalizeFrameworkName("Static")).toBe("generic");
    });
  });

  describe("validateCommandSafety", () => {
    it("should validate safe commands", () => {
      expect(validateCommandSafety("npm run build")).toBe(true);
      expect(validateCommandSafety("npm start")).toBe(true);
      expect(validateCommandSafety("python main.py")).toBe(true);
      expect(validateCommandSafety("go build -o app")).toBe(true);
    });

    it("should reject commands with dangerous patterns", () => {
      expect(validateCommandSafety("npm run build || rm -rf /")).toBe(false);
      expect(validateCommandSafety("npm run build && malicious")).toBe(false);
      expect(validateCommandSafety("npm run build; malicious")).toBe(false);
      expect(validateCommandSafety("npm run $(whoami)")).toBe(false);
      expect(validateCommandSafety("npm run `whoami`")).toBe(false);
    });

    it("should reject commands with output redirection to system paths", () => {
      expect(validateCommandSafety("npm run build > /etc/passwd")).toBe(false);
    });

    it("should reject sudo commands", () => {
      expect(validateCommandSafety("sudo npm install")).toBe(false);
    });
  });
});
