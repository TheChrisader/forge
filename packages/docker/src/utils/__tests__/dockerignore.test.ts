import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DockerIgnoreFilter, createDefaultIgnore, DEFAULT_IGNORE_PATTERNS } from "../dockerignore";

describe("DockerIgnoreFilter", () => {
  const testContext = "/tmp/test-context";

  describe("fromFile", () => {
    let tempDir: string;

    beforeEach(() => {
      // Create a temporary directory for testing
      tempDir = testContext;
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "readFileSync").mockReturnValue(
        `
        # Comments should be ignored
        node_modules
        *.log
        .env
        !.env.example
        test/
        build/
        *.md
        !README.md
      `
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("creates a filter from a .dockerignore file", () => {
      const filter = DockerIgnoreFilter.fromFile(tempDir);
      expect(filter).toBeInstanceOf(DockerIgnoreFilter);
    });

    it("returns null when .dockerignore doesn't exist", () => {
      vi.spyOn(fs, "existsSync").mockReturnValue(false);
      const filter = DockerIgnoreFilter.fromFile(tempDir);
      expect(filter).toBeNull();
    });
  });

  describe("fromContent", () => {
    it("creates a filter from content string", () => {
      const content = `
        node_modules
        *.log
        .env
      `;
      const filter = DockerIgnoreFilter.fromContent(testContext, content);
      expect(filter).toBeInstanceOf(DockerIgnoreFilter);
    });

    it("handles empty content", () => {
      const content = "";
      const filter = DockerIgnoreFilter.fromContent(testContext, content);
      expect(filter).toBeInstanceOf(DockerIgnoreFilter);
    });

    it("strips comments and empty lines", () => {
      const content = `
        # This is a comment
        node_modules

        # Another comment
        *.log
      `;
      const filter = DockerIgnoreFilter.fromContent(testContext, content);
      expect(filter.ignores("node_modules")).toBe(true);
      expect(filter.ignores("test.log")).toBe(true);
    });
  });

  describe("ignores", () => {
    it("matches directory patterns", () => {
      const filter = DockerIgnoreFilter.fromContent(testContext, "node_modules\n.git\n.vscode");

      expect(filter.ignores("node_modules")).toBe(true);
      expect(filter.ignores("node_modules/package/index.js")).toBe(true);
      expect(filter.ignores(".git")).toBe(true);
      expect(filter.ignores(".git/config")).toBe(true);
    });

    it("matches glob patterns", () => {
      const filter = DockerIgnoreFilter.fromContent(testContext, "*.log\n*.md\n.env.*");

      expect(filter.ignores("test.log")).toBe(true);
      expect(filter.ignores("error.log")).toBe(true);
      expect(filter.ignores("README.md")).toBe(true);
      expect(filter.ignores(".env.local")).toBe(true);
      expect(filter.ignores(".env.production")).toBe(true);
    });

    it("handles negation patterns", () => {
      const filter = DockerIgnoreFilter.fromContent(
        testContext,
        "*.log\n!debug.log\n.env.*\n!.env.example"
      );

      expect(filter.ignores("error.log")).toBe(true);
      expect(filter.ignores("debug.log")).toBe(false);
      expect(filter.ignores(".env.local")).toBe(true);
      expect(filter.ignores(".env.example")).toBe(false);
    });

    it("handles absolute paths correctly", () => {
      const filter = DockerIgnoreFilter.fromContent(testContext, "node_modules\n*.log");

      expect(filter.ignores(path.join(testContext, "node_modules"))).toBe(true);
      expect(filter.ignores(path.join(testContext, "test.log"))).toBe(true);
    });
  });

  describe("toTarIgnore", () => {
    it("creates a tar-fs compatible ignore function", () => {
      const filter = DockerIgnoreFilter.fromContent(testContext, "node_modules\n*.log");
      const ignoreFn = filter.toTarIgnore();

      expect(typeof ignoreFn).toBe("function");
      expect(ignoreFn("node_modules")).toBe(true);
      expect(ignoreFn("test.log")).toBe(true);
      expect(ignoreFn("src/index.ts")).toBe(false);
    });
  });
});

describe("createDefaultIgnore", () => {
  it("creates a function that ignores common patterns", () => {
    const ignoreFn = createDefaultIgnore();

    // Test some default patterns
    expect(ignoreFn("node_modules")).toBe(true);
    expect(ignoreFn("node_modules/package/index.js")).toBe(true);
    expect(ignoreFn(".git")).toBe(true);
    expect(ignoreFn(".env")).toBe(true);
    expect(ignoreFn(".env.local")).toBe(true);
    expect(ignoreFn("error.log")).toBe(true);
    expect(ignoreFn(".DS_Store")).toBe(true);
  });

  it("allows non-ignored files", () => {
    const ignoreFn = createDefaultIgnore();

    expect(ignoreFn("src/index.ts")).toBe(false);
    expect(ignoreFn("package.json")).toBe(false);
    expect(ignoreFn("README.md")).toBe(false);
    expect(ignoreFn("Dockerfile")).toBe(false);
  });

  it("handles .env.* patterns correctly", () => {
    const ignoreFn = createDefaultIgnore();

    expect(ignoreFn(".env.local")).toBe(true);
    expect(ignoreFn(".env.production")).toBe(true);
    expect(ignoreFn(".env.development")).toBe(true);
  });

  it("handles directory exclusion", () => {
    const ignoreFn = createDefaultIgnore();

    expect(ignoreFn("dist")).toBe(true);
    expect(ignoreFn("build")).toBe(true);
    expect(ignoreFn("coverage")).toBe(true);
    expect(ignoreFn(".next")).toBe(true);
    expect(ignoreFn(".nuxt")).toBe(true);
  });
});

describe("DEFAULT_IGNORE_PATTERNS", () => {
  it("contains expected patterns", () => {
    expect(DEFAULT_IGNORE_PATTERNS).toContain("node_modules");
    expect(DEFAULT_IGNORE_PATTERNS).toContain(".git");
    expect(DEFAULT_IGNORE_PATTERNS).toContain(".env");
    expect(DEFAULT_IGNORE_PATTERNS).toContain("*.log");
    expect(DEFAULT_IGNORE_PATTERNS).toContain(".DS_Store");
  });
});
