import { describe, it, expect } from "vitest";
import { generateNetworkName } from "../network-name";

describe("generateNetworkName", () => {
  const PROJECT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  describe("basic behavior", () => {
    it("generates name with format 'forge-project-{slug}-{projectId}'", () => {
      const name = generateNetworkName(PROJECT_ID, "My App");
      expect(name).toBe(`forge-project-my-app-${PROJECT_ID}`);
    });

    it("preserves projectId unchanged", () => {
      const name = generateNetworkName(PROJECT_ID, "test");
      expect(name.endsWith(PROJECT_ID)).toBe(true);
    });
  });

  describe("slugification", () => {
    it("converts uppercase to lowercase", () => {
      const name = generateNetworkName(PROJECT_ID, "MYAPP");
      expect(name).toContain("myapp");
    });

    it("replaces spaces with hyphens", () => {
      const name = generateNetworkName(PROJECT_ID, "my app");
      expect(name).toContain("my-app");
    });

    it("replaces multiple special characters with single hyphens", () => {
      const name = generateNetworkName(PROJECT_ID, "my @#$ app");
      expect(name).toContain("my-app");
    });

    it("handles underscores by replacing them with hyphens", () => {
      const name = generateNetworkName(PROJECT_ID, "my_app");
      expect(name).toContain("my-app");
    });

    it("preserves numbers in the slug", () => {
      const name = generateNetworkName(PROJECT_ID, "app123");
      expect(name).toContain("app123");
    });

    it("truncates slug to 50 characters maximum", () => {
      const longName = "a".repeat(100);
      const name = generateNetworkName(PROJECT_ID, longName);
      // "forge" + "project" + slug parts + uuid
      const slugStart = name.indexOf("forge-project-") + "forge-project-".length;
      const slugEnd = name.indexOf(`-${PROJECT_ID}`);
      const slug = name.substring(slugStart, slugEnd);
      expect(slug.length).toBeLessThanOrEqual(50);
    });

    it("removes leading and trailing hyphens from slug", () => {
      // "---my-app---" slugifies to "my-app" (hyphens are trimmed from ends)
      const name = generateNetworkName(PROJECT_ID, "---my-app---");
      expect(name).toBe(`forge-project-my-app-${PROJECT_ID}`);
    });
  });

  describe("edge cases", () => {
    it("handles empty project name by omitting slug segment", () => {
      const name = generateNetworkName(PROJECT_ID, "");
      expect(name).toBe(`forge-project-${PROJECT_ID}`);
    });

    it("handles project name that is entirely special chars", () => {
      const name = generateNetworkName(PROJECT_ID, "@#$%");
      // All chars get replaced with hyphens, then trimmed -> empty slug
      expect(name).toBe(`forge-project-${PROJECT_ID}`);
    });

    it("handles project name with accented characters", () => {
      const name = generateNetworkName(PROJECT_ID, "café");
      expect(name).toContain("caf");
    });
  });

  describe("custom prefix", () => {
    it("uses custom prefix when provided", () => {
      const name = generateNetworkName(PROJECT_ID, "test", { prefix: "custom" });
      expect(name).toBe(`custom-test-${PROJECT_ID}`);
    });

    it("falls back to 'forge-project' when no prefix specified", () => {
      const name = generateNetworkName(PROJECT_ID, "test");
      expect(name).toMatch(/^forge-project-/);
    });

    it("handles empty string prefix (falls back to default)", () => {
      // Empty prefix is falsy, so the default "forge-project" is used
      const name = generateNetworkName(PROJECT_ID, "test", { prefix: "" });
      expect(name).toBe(`forge-project-test-${PROJECT_ID}`);
    });
  });
});
