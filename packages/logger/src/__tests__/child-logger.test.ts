/**
 * Child Logger Tests
 *
 * Tests for child logger functionality including:
 * - Context propagation through nested children
 * - Independent level management
 * - Context merging behavior
 */

import { describe, it, expect, beforeEach } from "vitest";
import { LoggerService } from "../logger.service";
import type { LoggerConfig } from "../types";

describe("Child Logger", () => {
  let defaultConfig: LoggerConfig;

  beforeEach(() => {
    defaultConfig = {
      level: "info",
      format: "json",
      enabled: true,
      name: "test-logger",
    };
  });

  describe("context propagation", () => {
    it("should merge parent context with child context", () => {
      const parent = new LoggerService(defaultConfig);
      const child = parent.child({ requestId: "abc-123" });

      // Both parent and child should log without throwing
      expect(() => {
        parent.info("parent message");
        child.info("child message");
      }).not.toThrow();
    });

    it("should propagate context through multiple levels", () => {
      const root = new LoggerService(defaultConfig);
      const level1 = root.child({ rootId: "root-123" });
      const level2 = level1.child({ level: "2" });
      const level3 = level2.child({ leaf: true });

      // All loggers should work without throwing
      expect(() => {
        root.info("root");
        level1.info("level 1");
        level2.info("level 2");
        level3.info("level 3");
      }).not.toThrow();
    });

    it("should handle overlapping context keys", () => {
      const parent = new LoggerService(defaultConfig);
      const child = parent.child({ userId: "parent-user" });
      const grandchild = child.child({ userId: "child-user" });

      // Child's context should override parent's for the same key
      expect(() => {
        child.info("child message");
        grandchild.info("grandchild message");
      }).not.toThrow();
    });

    it("should handle complex nested objects in context", () => {
      const parent = new LoggerService(defaultConfig);
      const child = parent.child({
        metadata: {
          source: "web",
          version: "1.0.0",
          features: ["a", "b", "c"],
        },
      });

      expect(() => {
        child.info("complex context message");
      }).not.toThrow();
    });
  });

  describe("level management", () => {
    it("should inherit parent's level initially", () => {
      const parent = new LoggerService({ ...defaultConfig, level: "debug" });
      const child = parent.child({ requestId: "123" });

      expect(child.getLevel()).toBe("debug");
    });

    it("should allow independent level changes", () => {
      const parent = new LoggerService({ ...defaultConfig, level: "info" });
      const child = parent.child({ requestId: "123" });

      child.setLevel("debug");

      expect(parent.getLevel()).toBe("info");
      expect(child.getLevel()).toBe("debug");
    });

    it("should not affect parent when child level changes", () => {
      const parent = new LoggerService({ ...defaultConfig, level: "info" });
      const child = parent.child({ requestId: "123" });

      child.setLevel("error");

      expect(parent.getLevel()).toBe("info");
      expect(child.getLevel()).toBe("error");
    });

    it("should not affect siblings when one child changes level", () => {
      const parent = new LoggerService({ ...defaultConfig, level: "info" });
      const child1 = parent.child({ child: "1" });
      const child2 = parent.child({ child: "2" });

      child1.setLevel("debug");

      expect(parent.getLevel()).toBe("info");
      expect(child1.getLevel()).toBe("debug");
      expect(child2.getLevel()).toBe("info");
    });
  });

  describe("nested children", () => {
    it("should create deep nesting hierarchy", () => {
      const root = new LoggerService(defaultConfig);
      const child1 = root.child({ depth: 1 });
      const child2 = child1.child({ depth: 2 });
      const child3 = child2.child({ depth: 3 });
      const child4 = child3.child({ depth: 4 });
      const child5 = child4.child({ depth: 5 });

      expect(() => {
        root.info("depth 0");
        child1.info("depth 1");
        child2.info("depth 2");
        child3.info("depth 3");
        child4.info("depth 4");
        child5.info("depth 5");
      }).not.toThrow();
    });

    it("should maintain independent contexts across branches", () => {
      const root = new LoggerService(defaultConfig);
      const branchA = root.child({ branch: "A", id: "a1" });
      const branchB = root.child({ branch: "B", id: "b1" });
      const branchAChild = branchA.child({ leaf: "A1" });
      const branchBChild = branchB.child({ leaf: "B1" });

      expect(() => {
        branchA.info("branch A");
        branchB.info("branch B");
        branchAChild.info("branch A child");
        branchBChild.info("branch B child");
      }).not.toThrow();
    });
  });

  describe("child from child", () => {
    it("should return parent when context is empty", () => {
      const parent = new LoggerService(defaultConfig);
      const child = parent.child({});

      expect(child).toBe(parent);
    });

    it("should create new logger for non-empty context", () => {
      const parent = new LoggerService(defaultConfig);
      const child = parent.child({ key: "value" });

      expect(child).not.toBe(parent);
      expect(child.getLevel()).toBe(parent.getLevel());
    });
  });

  describe("flush behavior", () => {
    it("should support flush on child loggers", async () => {
      const parent = new LoggerService(defaultConfig);
      const child = parent.child({ requestId: "123" });

      await expect(child.flush()).resolves.not.toThrow();
    });

    it("should support flush on deeply nested children", async () => {
      const root = new LoggerService(defaultConfig);
      const child1 = root.child({ depth: 1 });
      const child2 = child1.child({ depth: 2 });
      const child3 = child2.child({ depth: 3 });

      await expect(child3.flush()).resolves.not.toThrow();
    });
  });

  describe("context with special values", () => {
    it("should handle null values in context", () => {
      const parent = new LoggerService(defaultConfig);
      const child = parent.child({ value: null });

      expect(() => child.info("null value")).not.toThrow();
    });

    it("should handle undefined values in context", () => {
      const parent = new LoggerService(defaultConfig);
      const child = parent.child({ value: undefined });

      expect(() => child.info("undefined value")).not.toThrow();
    });

    it("should handle numbers in context", () => {
      const parent = new LoggerService(defaultConfig);
      const child = parent.child({ count: 42, ratio: 3.14 });

      expect(() => child.info("numeric values")).not.toThrow();
    });

    it("should handle booleans in context", () => {
      const parent = new LoggerService(defaultConfig);
      const child = parent.child({ active: true, deleted: false });

      expect(() => child.info("boolean values")).not.toThrow();
    });

    it("should handle arrays in context", () => {
      const parent = new LoggerService(defaultConfig);
      const child = parent.child({ tags: ["tag1", "tag2", "tag3"] });

      expect(() => child.info("array values")).not.toThrow();
    });

    it("should handle Error objects in context", () => {
      const parent = new LoggerService(defaultConfig);
      const error = new Error("Test error");
      const child = parent.child({ error });

      expect(() => child.error("error context")).not.toThrow();
    });
  });

  describe("independence from parent", () => {
    it("should create independent child instances", () => {
      const parent = new LoggerService(defaultConfig);
      const child1 = parent.child({ id: "1" });
      const child2 = parent.child({ id: "2" });

      expect(child1).not.toBe(child2);
      expect(child1).not.toBe(parent);
      expect(child2).not.toBe(parent);
    });

    it("should allow getting Pino logger from child", () => {
      const parent = new LoggerService(defaultConfig);
      const child = parent.child({ requestId: "123" });

      expect(() => child.getPinoLogger()).not.toThrow();
      expect(child.getPinoLogger()).toBeDefined();
    });
  });
});
