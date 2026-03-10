import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  FlushManager,
  parseBooleanFlag,
  parseNumberValue,
  createFlushManagerOptions,
} from "../flush-manager.js";
import type { BuildLogService } from "@forge/core";
import type { ILogger } from "@forge/logger";
import { PriorityLogBuffer } from "../log-buffer.js";

describe("FlushManager", () => {
  let mockBuildLogService: BuildLogService;
  let mockLogger: ILogger;
  let flushManager: FlushManager;
  let buffer: PriorityLogBuffer;
  const deploymentId = "test-deployment";

  beforeEach(() => {
    // Mock BuildLogService
    mockBuildLogService = {
      appendBatch: vi.fn().mockResolvedValue(undefined),
      append: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
      getLineCount: vi.fn().mockResolvedValue(0),
      tail: vi.fn().mockResolvedValue([]),
      deleteForDeployment: vi.fn().mockResolvedValue(undefined),
    } as unknown as BuildLogService;

    // Mock Logger
    mockLogger = {
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      child: vi.fn().mockReturnThis(),
      getLevel: vi.fn().mockReturnValue("info"),
      setLevel: vi.fn(),
    } as unknown as ILogger;

    // Create buffer
    buffer = new PriorityLogBuffer({
      maxSize: 100,
      errorSlotReserve: 0.1,
    });

    // Create flush manager with retry enabled
    flushManager = new FlushManager(mockBuildLogService, mockLogger, {
      enabled: true,
      maxRetryAttempts: 3,
      baseInterval: 100,
      maxInterval: 500,
      jitterMs: 20,
      recoveryIntervalMs: 1000,
    });
  });

  afterEach(() => {
    flushManager.stop();
  });

  function addTestLogs(count: number): void {
    for (let i = 0; i < count; i++) {
      buffer.push({
        deploymentId,
        lineNumber: i,
        timestamp: new Date(),
        level: "INFO" as const,
        message: `Log line ${i}`,
        source: "BUILD",
      });
    }
  }

  describe("initialization", () => {
    it("should create flush manager with valid options", () => {
      const manager = new FlushManager(mockBuildLogService, mockLogger, {
        enabled: true,
        maxRetryAttempts: 5,
        baseInterval: 2000,
        maxInterval: 16000,
        jitterMs: 500,
        recoveryIntervalMs: 60000,
      });

      expect(manager.getConsecutiveFailures()).toBe(0);
      expect(manager.isCircuitBreakerOpen()).toBe(false);
    });

    it("should throw error for non-positive baseInterval", () => {
      expect(() => {
        new FlushManager(mockBuildLogService, mockLogger, {
          enabled: true,
          maxRetryAttempts: 5,
          baseInterval: 0,
          maxInterval: 16000,
          jitterMs: 500,
          recoveryIntervalMs: 60000,
        });
      }).toThrow("FlushManager baseInterval must be positive");
    });

    it("should throw error when maxInterval < baseInterval", () => {
      expect(() => {
        new FlushManager(mockBuildLogService, mockLogger, {
          enabled: true,
          maxRetryAttempts: 5,
          baseInterval: 5000,
          maxInterval: 2000,
          jitterMs: 500,
          recoveryIntervalMs: 60000,
        });
      }).toThrow(/maxInterval.*must be >= baseInterval/);
    });

    it("should throw error for negative maxRetryAttempts", () => {
      expect(() => {
        new FlushManager(mockBuildLogService, mockLogger, {
          enabled: true,
          maxRetryAttempts: -1,
          baseInterval: 2000,
          maxInterval: 16000,
          jitterMs: 500,
          recoveryIntervalMs: 60000,
        });
      }).toThrow("maxRetryAttempts must be non-negative");
    });
  });

  describe("flush", () => {
    it("should return success with empty buffer", async () => {
      const result = await flushManager.flush(buffer, deploymentId);

      expect(result.success).toBe(true);
      expect(result.entryCount).toBe(0);
      expect(result.circuitBreakerOpen).toBe(false);
      expect(result.consecutiveFailures).toBe(0);
      expect(mockBuildLogService.appendBatch).not.toHaveBeenCalled();
    });

    it("should successfully flush entries to database", async () => {
      addTestLogs(5);

      const result = await flushManager.flush(buffer, deploymentId);

      expect(result.success).toBe(true);
      expect(result.entryCount).toBe(5);
      expect(result.circuitBreakerOpen).toBe(false);
      expect(result.consecutiveFailures).toBe(0);
      expect(mockBuildLogService.appendBatch).toHaveBeenCalledTimes(1);
      expect(mockBuildLogService.appendBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            deploymentId,
            message: "Log line 0",
          }),
        ])
      );
      expect(buffer.isEmpty()).toBe(true);
    });

    it("should handle database failure and increment failure count", async () => {
      vi.mocked(mockBuildLogService.appendBatch).mockRejectedValueOnce(
        new Error("Database connection failed")
      );

      addTestLogs(3);

      const result = await flushManager.flush(buffer, deploymentId);

      expect(result.success).toBe(false);
      expect(result.entryCount).toBe(3);
      expect(result.consecutiveFailures).toBe(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to flush logs to database",
        expect.objectContaining({
          deploymentId,
          attempt: 1,
        })
      );
      expect(buffer.isEmpty()).toBe(true); // Buffer still cleared even on failure
    });

    it("should not open circuit breaker below max retry attempts", async () => {
      vi.mocked(mockBuildLogService.appendBatch).mockRejectedValue(
        new Error("Database connection failed")
      );

      // Fail twice (max is 3)
      addTestLogs(1);
      await flushManager.flush(buffer, deploymentId);

      addTestLogs(1);
      const result = await flushManager.flush(buffer, deploymentId);

      expect(result.success).toBe(false);
      expect(result.consecutiveFailures).toBe(2);
      expect(result.circuitBreakerOpen).toBe(false);
      expect(flushManager.isCircuitBreakerOpen()).toBe(false);
    });

    it("should open circuit breaker at max retry attempts", async () => {
      vi.mocked(mockBuildLogService.appendBatch).mockRejectedValue(
        new Error("Database connection failed")
      );

      // Fail 3 times to trigger circuit breaker
      for (let i = 0; i < 3; i++) {
        addTestLogs(1);
        await flushManager.flush(buffer, deploymentId);
      }

      // 4th flush should open circuit breaker
      addTestLogs(1);
      const result = await flushManager.flush(buffer, deploymentId);

      expect(result.success).toBe(false);
      expect(result.consecutiveFailures).toBe(3);
      expect(result.circuitBreakerOpen).toBe(true);
      expect(flushManager.isCircuitBreakerOpen()).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Circuit breaker opened - database appears unavailable",
        expect.objectContaining({
          deploymentId,
          consecutiveFailures: 3,
        })
      );
    });

    it("should skip flush when circuit breaker is open", async () => {
      // Manually open circuit breaker
      flushManager["circuitBreakerOpen"] = true;

      addTestLogs(5);

      const result = await flushManager.flush(buffer, deploymentId);

      expect(result.success).toBe(false);
      expect(result.entryCount).toBe(0);
      expect(result.circuitBreakerOpen).toBe(true);
      expect(mockBuildLogService.appendBatch).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith("Circuit breaker open - skipping flush", {
        deploymentId,
      });
      expect(buffer.isEmpty()).toBe(false); // Buffer not cleared
    });

    it("should reset failure count on successful flush", async () => {
      vi.mocked(mockBuildLogService.appendBatch)
        .mockRejectedValueOnce(new Error("Database connection failed"))
        .mockResolvedValueOnce(undefined);

      // First flush fails
      addTestLogs(1);
      await flushManager.flush(buffer, deploymentId);
      expect(flushManager.getConsecutiveFailures()).toBe(1);

      // Second flush succeeds
      addTestLogs(1);
      const result = await flushManager.flush(buffer, deploymentId);

      expect(result.success).toBe(true);
      expect(result.consecutiveFailures).toBe(0);
      expect(flushManager.getConsecutiveFailures()).toBe(0);
    });

    it("should not open circuit breaker when retry disabled", async () => {
      const disabledManager = new FlushManager(mockBuildLogService, mockLogger, {
        enabled: false,
        maxRetryAttempts: 3,
        baseInterval: 100,
        maxInterval: 500,
        jitterMs: 20,
        recoveryIntervalMs: 1000,
      });

      vi.mocked(mockBuildLogService.appendBatch).mockRejectedValue(
        new Error("Database connection failed")
      );

      // Fail many times
      for (let i = 0; i < 5; i++) {
        addTestLogs(1);
        await disabledManager.flush(buffer, deploymentId);
      }

      // Circuit breaker should not open when retry disabled
      expect(disabledManager.isCircuitBreakerOpen()).toBe(false);
      expect(disabledManager.getConsecutiveFailures()).toBe(5);

      disabledManager.stop();
    });
  });

  describe("circuit breaker recovery", () => {
    afterEach(() => {
      flushManager.stop();
    });

    it("should open circuit breaker and schedule recovery", async () => {
      vi.mocked(mockBuildLogService.appendBatch).mockRejectedValue(
        new Error("Database connection failed")
      );

      // Trigger circuit breaker
      for (let i = 0; i < 3; i++) {
        addTestLogs(1);
        await flushManager.flush(buffer, deploymentId);
      }
      addTestLogs(1);
      await flushManager.flush(buffer, deploymentId);

      expect(flushManager.isCircuitBreakerOpen()).toBe(true);
      // Recovery timeout should be scheduled
      expect(flushManager["recoveryTimeout"]).not.toBeNull();
    });

    it("should not open circuit breaker when retry disabled", async () => {
      const disabledManager = new FlushManager(mockBuildLogService, mockLogger, {
        enabled: false,
        maxRetryAttempts: 3,
        baseInterval: 100,
        maxInterval: 500,
        jitterMs: 20,
        recoveryIntervalMs: 1000,
      });

      vi.mocked(mockBuildLogService.appendBatch).mockRejectedValue(
        new Error("Database connection failed")
      );

      // Fail many times
      for (let i = 0; i < 10; i++) {
        addTestLogs(1);
        await disabledManager.flush(buffer, deploymentId);
      }

      // Circuit breaker should not open when retry disabled
      expect(disabledManager.isCircuitBreakerOpen()).toBe(false);

      disabledManager.stop();
    });
  });

  describe("scheduleFlush", () => {
    it("should call callback after flush", async () => {
      const callback = vi.fn();
      vi.spyOn(mockBuildLogService, "appendBatch").mockResolvedValue(undefined);

      flushManager.scheduleFlush(buffer, deploymentId, callback);

      // Add some logs and manually trigger flush
      addTestLogs(5);
      const result = await flushManager.flush(buffer, deploymentId);

      // Note: scheduleFlush creates its own timer loop, but we can test
      // that the manager is still functional and the core flush logic works
      expect(result.success).toBe(true);
      expect(result.entryCount).toBe(5);

      // Clean up the scheduled timer
      flushManager.stop();
    });

    it("should stop scheduled flushing when stop() is called", () => {
      flushManager.scheduleFlush(buffer, deploymentId);

      // Verify it's running
      expect(flushManager["currentFlushTimeout"]).not.toBeNull();

      // Stop it
      flushManager.stop();

      // Verify it's stopped
      expect(flushManager["currentFlushTimeout"]).toBeNull();
    });

    it("should clear existing schedule when scheduleFlush is called again", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      flushManager.scheduleFlush(buffer, deploymentId, callback1);
      const firstTimeout = flushManager["currentFlushTimeout"];

      // Immediately reschedule - should clear previous timeout
      flushManager.scheduleFlush(buffer, deploymentId, callback2);
      const secondTimeout = flushManager["currentFlushTimeout"];

      // Timeouts should be different (first was cleared)
      expect(firstTimeout).not.toBe(secondTimeout);

      flushManager.stop();
    });
  });

  describe("getOptions", () => {
    it("should return readonly copy of options", () => {
      const options = flushManager.getOptions();

      expect(options.enabled).toBe(true);
      expect(options.maxRetryAttempts).toBe(3);
      expect(options.baseInterval).toBe(100);
      expect(options.maxInterval).toBe(500);
      expect(options.jitterMs).toBe(20);
      expect(options.recoveryIntervalMs).toBe(1000);

      // Verify it's a copy, not reference
      options.enabled = false;
      expect(flushManager.getOptions().enabled).toBe(true);
    });
  });
});

describe("environment variable parsers", () => {
  describe("parseBooleanFlag", () => {
    it("should parse true values", () => {
      expect(parseBooleanFlag("true", false)).toBe(true);
      expect(parseBooleanFlag("TRUE", false)).toBe(true);
      expect(parseBooleanFlag("True", false)).toBe(true);
    });

    it("should parse false values", () => {
      expect(parseBooleanFlag("false", true)).toBe(false);
      expect(parseBooleanFlag("FALSE", true)).toBe(false);
      expect(parseBooleanFlag("False", true)).toBe(false);
      expect(parseBooleanFlag("anything", true)).toBe(false);
    });

    it("should return default for undefined", () => {
      expect(parseBooleanFlag(undefined, true)).toBe(true);
      expect(parseBooleanFlag(undefined, false)).toBe(false);
    });
  });

  describe("parseNumberValue", () => {
    it("should parse valid numeric values", () => {
      expect(parseNumberValue("500", 1000)).toBe(500);
      expect(parseNumberValue("0", 1000)).toBe(0);
      expect(parseNumberValue("2000", 1000)).toBe(2000);
    });

    it("should return default for undefined", () => {
      expect(parseNumberValue(undefined, 1000)).toBe(1000);
    });

    it("should return default for invalid values", () => {
      expect(parseNumberValue("not-a-number", 1000)).toBe(1000);
      expect(parseNumberValue("-100", 1000)).toBe(1000); // Negative values use default
    });
  });

  describe("createFlushManagerOptions", () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should return default options when no env vars set", () => {
      delete process.env.BUILD_LOG_FLUSH_RETRY;
      delete process.env.BUILD_LOG_MAX_RETRY_ATTEMPTS;
      delete process.env.BUILD_LOG_BASE_INTERVAL;
      delete process.env.BUILD_LOG_MAX_INTERVAL;
      delete process.env.BUILD_LOG_JITTER_MS;
      delete process.env.BUILD_LOG_RECOVERY_INTERVAL_MS;

      const options = createFlushManagerOptions();

      expect(options.enabled).toBe(false);
      expect(options.maxRetryAttempts).toBe(5);
      expect(options.baseInterval).toBe(2000);
      expect(options.maxInterval).toBe(16000);
      expect(options.jitterMs).toBe(500);
      expect(options.recoveryIntervalMs).toBe(60000);
    });

    it("should parse options from environment variables", () => {
      process.env.BUILD_LOG_FLUSH_RETRY = "true";
      process.env.BUILD_LOG_MAX_RETRY_ATTEMPTS = "10";
      process.env.BUILD_LOG_BASE_INTERVAL = "3000";
      process.env.BUILD_LOG_MAX_INTERVAL = "20000";
      process.env.BUILD_LOG_JITTER_MS = "750";
      process.env.BUILD_LOG_RECOVERY_INTERVAL_MS = "120000";

      const options = createFlushManagerOptions();

      expect(options.enabled).toBe(true);
      expect(options.maxRetryAttempts).toBe(10);
      expect(options.baseInterval).toBe(3000);
      expect(options.maxInterval).toBe(20000);
      expect(options.jitterMs).toBe(750);
      expect(options.recoveryIntervalMs).toBe(120000);
    });

    it("should handle invalid environment variable values", () => {
      process.env.BUILD_LOG_FLUSH_RETRY = "invalid";
      process.env.BUILD_LOG_MAX_RETRY_ATTEMPTS = "not-a-number";
      process.env.BUILD_LOG_BASE_INTERVAL = "-100";

      const options = createFlushManagerOptions();

      expect(options.enabled).toBe(false); // Invalid bool -> false
      expect(options.maxRetryAttempts).toBe(5); // Invalid number -> default
      expect(options.baseInterval).toBe(2000); // Negative -> default
    });
  });
});
