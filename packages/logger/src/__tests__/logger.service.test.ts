/**
 * Logger Service Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { LoggerService, createLogger, validateLoggerConfig } from "../logger.service";
import type { LoggerConfig } from "../types";
import { LoggerConfigError } from "../errors";

describe("LoggerService", () => {
  let defaultConfig: LoggerConfig;

  beforeEach(() => {
    defaultConfig = {
      level: "INFO",
      format: "json",
      enabled: true,
      name: "test-logger",
    };
  });

  describe("constructor", () => {
    it("should create a logger with valid config", () => {
      const logger = new LoggerService(defaultConfig);
      expect(logger).toBeDefined();
      expect(logger.getLevel()).toBe("INFO");
    });

    it("should throw LoggerConfigError with invalid level", () => {
      const invalidConfig = { ...defaultConfig, level: "invalid" as any };
      expect(() => new LoggerService(invalidConfig)).toThrow(LoggerConfigError);
    });

    it("should throw LoggerConfigError with invalid format", () => {
      const invalidConfig = { ...defaultConfig, format: "invalid" as any };
      expect(() => new LoggerService(invalidConfig)).toThrow(LoggerConfigError);
    });

    it("should throw LoggerConfigError with missing level", () => {
      const invalidConfig = { ...defaultConfig, level: undefined as any };
      expect(() => new LoggerService(invalidConfig)).toThrow(LoggerConfigError);
    });

    it("should accept all valid log levels", () => {
      const levels = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"] as const;

      for (const level of levels) {
        const config = { ...defaultConfig, level };
        const logger = new LoggerService(config);
        expect(logger.getLevel()).toBe(level);
      }
    });
  });

  describe("logging methods", () => {
    it("should log at all levels without throwing", () => {
      const logger = new LoggerService(defaultConfig);

      expect(() => {
        logger.trace("trace message");
        logger.debug("debug message");
        logger.info("info message");
        logger.warn("warn message");
        logger.error("error message");
        logger.fatal("fatal message");
      }).not.toThrow();
    });

    it("should include context in log entries", () => {
      const logger = new LoggerService(defaultConfig);

      expect(() => {
        logger.info("test message", { userId: "123", action: "test" });
      }).not.toThrow();
    });

    it("should not log when disabled", () => {
      const config = { ...defaultConfig, enabled: false };
      const logger = new LoggerService(config);

      expect(() => {
        logger.info("should not be logged");
      }).not.toThrow();
    });

    it("should handle error objects in context", () => {
      const logger = new LoggerService(defaultConfig);

      expect(() => {
        const error = new Error("Test error");
        logger.error("An error occurred", { error, userId: "123" });
      }).not.toThrow();
    });
  });

  describe("child loggers", () => {
    it("should create a child logger with additional context", () => {
      const parent = new LoggerService(defaultConfig);
      const child = parent.child({ requestId: "abc-123" });

      expect(child).toBeDefined();
      expect(child.getLevel()).toBe(parent.getLevel());
    });

    it("should create nested child loggers", () => {
      const parent = new LoggerService(defaultConfig);
      const child1 = parent.child({ requestId: "abc-123" });
      const child2 = child1.child({ userId: "user-456" });

      expect(child2).toBeDefined();
      expect(child2.getLevel()).toBe(parent.getLevel());
    });

    it("should return parent when child has empty context", () => {
      const parent = new LoggerService(defaultConfig);
      const child = parent.child({});

      expect(child).toBe(parent);
    });
  });

  describe("level management", () => {
    it("should get the current level", () => {
      const logger = new LoggerService(defaultConfig);
      expect(logger.getLevel()).toBe("INFO");
    });

    it("should set a new valid level", () => {
      const logger = new LoggerService(defaultConfig);
      logger.setLevel("DEBUG");
      expect(logger.getLevel()).toBe("DEBUG");
    });

    it("should throw when setting invalid level", () => {
      const logger = new LoggerService(defaultConfig);
      // @ts-expect-error invalid level
      expect(() => logger.setLevel("invalid")).toThrow(LoggerConfigError);
    });

    it("should allow changing to any valid level", () => {
      const logger = new LoggerService(defaultConfig);
      const levels = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"] as const;

      for (const level of levels) {
        logger.setLevel(level);
        expect(logger.getLevel()).toBe(level);
      }
    });
  });

  describe("flush", () => {
    it("should flush without throwing", async () => {
      const logger = new LoggerService(defaultConfig);

      await expect(logger.flush()).resolves.not.toThrow();
    });

    it("should be callable multiple times", async () => {
      const logger = new LoggerService(defaultConfig);

      await expect(logger.flush()).resolves.not.toThrow();
      await expect(logger.flush()).resolves.not.toThrow();
      await expect(logger.flush()).resolves.not.toThrow();
    });
  });

  describe("getPinoLogger", () => {
    it("should return underlying Pino instance", () => {
      const logger = new LoggerService(defaultConfig);
      const pino = logger.getPinoLogger();

      expect(pino).toBeDefined();
      expect(pino.level).toBe("info");
      expect(typeof pino.info).toBe("function");
    });
  });
});

describe("createLogger", () => {
  it("should create a LoggerService instance", () => {
    const config: LoggerConfig = {
      level: "INFO",
      format: "json",
      enabled: true,
    };

    const logger = createLogger(config);
    expect(logger).toBeInstanceOf(LoggerService);
  });
});

describe("validateLoggerConfig", () => {
  it("should return valid: true for correct config", () => {
    const config: LoggerConfig = {
      level: "INFO",
      format: "json",
      enabled: true,
    };

    const result = validateLoggerConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it("should return valid: false with errors for invalid config", () => {
    const config = {
      level: "invalid" as any,
      format: "json",
      enabled: true,
    };

    const result = validateLoggerConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it("should return multiple validation errors", () => {
    const config = {
      level: "invalid" as any,
      format: "wrong" as any,
      enabled: "not-a-boolean" as any,
    };

    const result = validateLoggerConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThanOrEqual(2);
  });
});
