import { describe, it, expect } from "vitest";
import { generateImageName, generateImageTagPrefix } from "../utils/image-name-generator.js";

describe("image-name-generator", () => {
  describe("generateImageName", () => {
    it("should generate a basic image name", () => {
      const result = generateImageName("myapp", "dpl_1234567890abcdef");
      expect(result).toBe("forge/myapp:dpl_1234");
    });

    it("should convert project name to lowercase", () => {
      const result = generateImageName("MyAwesomeApp", "dpl_1234567890abcdef");
      expect(result).toBe("forge/myawesomeapp:dpl_1234");
    });

    it("should replace spaces with hyphens", () => {
      const result = generateImageName("my awesome app", "dpl_1234567890abcdef");
      expect(result).toBe("forge/my-awesome-app:dpl_1234");
    });

    it("should replace special characters with hyphens", () => {
      const result = generateImageName("my-awesome_app!", "dpl_1234567890abcdef");
      expect(result).toBe("forge/my-awesome-app:dpl_1234");
    });

    it("should handle multiple consecutive special characters", () => {
      const result = generateImageName("my   app!!!", "dpl_1234567890abcdef");
      expect(result).toBe("forge/my-app:dpl_1234");
    });

    it("should remove leading special characters", () => {
      const result = generateImageName("---myapp", "dpl_1234567890abcdef");
      expect(result).toBe("forge/myapp:dpl_1234");
    });

    it("should remove trailing special characters", () => {
      const result = generateImageName("myapp---", "dpl_1234567890abcdef");
      expect(result).toBe("forge/myapp:dpl_1234");
    });

    it("should remove leading and trailing special characters", () => {
      const result = generateImageName("---myapp---", "dpl_1234567890abcdef");
      expect(result).toBe("forge/myapp:dpl_1234");
    });

    it("should shorten deployment ID to 8 characters", () => {
      const result = generateImageName("myapp", "dpl_1234567890abcdef");
      expect(result).toContain(":dpl_1234");
    });

    it("should handle short deployment IDs", () => {
      const result = generateImageName("myapp", "dpl_12");
      expect(result).toBe("forge/myapp:dpl_12");
    });

    it("should handle project names with numbers", () => {
      const result = generateImageName("app2-v3", "dpl_1234567890abcdef");
      expect(result).toBe("forge/app2-v3:dpl_1234");
    });

    it("should handle underscores in project name", () => {
      const result = generateImageName("my_awesome_app", "dpl_1234567890abcdef");
      expect(result).toBe("forge/my-awesome-app:dpl_1234");
    });

    it("should throw for empty project name", () => {
      expect(() => generateImageName("", "dpl_1234567890abcdef")).toThrow(
        "Project name must contain at least one alphanumeric character"
      );
    });

    it("should throw for project name with only special characters", () => {
      expect(() => generateImageName("---!!!___", "dpl_1234567890abcdef")).toThrow(
        "Project name must contain at least one alphanumeric character"
      );
    });

    it("should throw for whitespace-only project name", () => {
      expect(() => generateImageName("   ", "dpl_1234567890abcdef")).toThrow(
        "Project name must contain at least one alphanumeric character"
      );
    });
  });

  describe("generateImageTagPrefix", () => {
    it("should generate a basic tag prefix", () => {
      const result = generateImageTagPrefix("myapp");
      expect(result).toBe("forge/myapp:");
    });

    it("should convert project name to lowercase", () => {
      const result = generateImageTagPrefix("MyAwesomeApp");
      expect(result).toBe("forge/myawesomeapp:");
    });

    it("should replace spaces with hyphens", () => {
      const result = generateImageTagPrefix("my awesome app");
      expect(result).toBe("forge/my-awesome-app:");
    });

    it("should replace special characters with hyphens", () => {
      const result = generateImageTagPrefix("my-awesome_app!");
      expect(result).toBe("forge/my-awesome-app:");
    });

    it("should remove leading and trailing special characters", () => {
      const result = generateImageTagPrefix("---myapp---");
      expect(result).toBe("forge/myapp:");
    });

    it("should always end with colon", () => {
      const result = generateImageTagPrefix("myapp");
      expect(result).toMatch(/:$/);
    });

    it("should throw for empty project name", () => {
      expect(() => generateImageTagPrefix("")).toThrow(
        "Project name must contain at least one alphanumeric character"
      );
    });

    it("should throw for project name with only special characters", () => {
      expect(() => generateImageTagPrefix("---!!!___")).toThrow(
        "Project name must contain at least one alphanumeric character"
      );
    });
  });
});
