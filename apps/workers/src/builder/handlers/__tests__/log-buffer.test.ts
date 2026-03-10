import { describe, it, expect, beforeEach } from "vitest";
import {
  LogBuffer,
  PriorityLogBuffer,
  parseBufferSize,
  parseDropStrategy,
  parseErrorSlotReserve,
} from "../log-buffer.js";
import type { BuildLogEntry } from "@forge/core";
import type { LogLevel } from "@forge/types";

describe("LogBuffer", () => {
  let buffer: LogBuffer;
  const maxSize = 10;

  beforeEach(() => {
    buffer = new LogBuffer({ maxSize, dropStrategy: "ring" });
  });

  function createMockEntry(lineNumber: number, level: LogLevel = "INFO"): BuildLogEntry {
    return {
      deploymentId: "test-deployment",
      lineNumber,
      timestamp: new Date(),
      level,
      message: `Log line ${lineNumber}`,
      source: "BUILD",
    };
  }

  describe("initialization", () => {
    it("should create buffer with valid options", () => {
      expect(buffer.getMaxSize()).toBe(maxSize);
      expect(buffer.getLength()).toBe(0);
      expect(buffer.isEmpty()).toBe(true);
      expect(buffer.getDroppedCount()).toBe(0);
    });

    it("should throw error for non-positive maxSize", () => {
      expect(() => new LogBuffer({ maxSize: 0, dropStrategy: "ring" })).toThrow(
        "LogBuffer maxSize must be positive"
      );
      expect(() => new LogBuffer({ maxSize: -1, dropStrategy: "ring" })).toThrow(
        "LogBuffer maxSize must be positive"
      );
    });
  });

  describe("push with ring strategy", () => {
    it("should accept entries when buffer is not full", () => {
      for (let i = 0; i < maxSize; i++) {
        const accepted = buffer.push(createMockEntry(i));
        expect(accepted).toBe(true);
      }

      expect(buffer.getLength()).toBe(maxSize);
      expect(buffer.getDroppedCount()).toBe(0);
    });

    it("should drop oldest entry when buffer is full (ring buffer)", () => {
      // Fill buffer
      for (let i = 0; i < maxSize; i++) {
        buffer.push(createMockEntry(i));
      }

      // Add one more - should drop oldest (line 0)
      const accepted = buffer.push(createMockEntry(maxSize));
      expect(accepted).toBe(true);
      expect(buffer.getLength()).toBe(maxSize);
      expect(buffer.getDroppedCount()).toBe(1);

      // Flush and verify oldest entry was dropped
      const entries = buffer.flush();
      expect(entries).toHaveLength(maxSize);
      expect(entries[0].lineNumber).toBe(1); // Entry 0 was dropped
      expect(entries[maxSize - 1].lineNumber).toBe(maxSize);
    });

    it("should continuously ring buffer when over capacity", () => {
      // Fill buffer
      for (let i = 0; i < maxSize; i++) {
        buffer.push(createMockEntry(i));
      }

      // Add 5 more entries - should drop 5 oldest
      for (let i = maxSize; i < maxSize + 5; i++) {
        buffer.push(createMockEntry(i));
      }

      expect(buffer.getLength()).toBe(maxSize);
      expect(buffer.getDroppedCount()).toBe(5);

      const entries = buffer.flush();
      expect(entries).toHaveLength(maxSize);
      expect(entries[0].lineNumber).toBe(5); // Entries 0-4 were dropped
      expect(entries[maxSize - 1].lineNumber).toBe(maxSize + 4);
    });
  });

  describe("push with reject strategy", () => {
    beforeEach(() => {
      buffer = new LogBuffer({ maxSize, dropStrategy: "reject" });
    });

    it("should accept entries when buffer is not full", () => {
      for (let i = 0; i < maxSize; i++) {
        const accepted = buffer.push(createMockEntry(i));
        expect(accepted).toBe(true);
      }

      expect(buffer.getLength()).toBe(maxSize);
      expect(buffer.getDroppedCount()).toBe(0);
    });

    it("should reject new entries when buffer is full", () => {
      // Fill buffer
      for (let i = 0; i < maxSize; i++) {
        buffer.push(createMockEntry(i));
      }

      // Try to add more - should be rejected
      for (let i = 0; i < 5; i++) {
        const accepted = buffer.push(createMockEntry(maxSize + i));
        expect(accepted).toBe(false);
      }

      expect(buffer.getLength()).toBe(maxSize);
      expect(buffer.getDroppedCount()).toBe(5);

      // Flush should have original entries
      const entries = buffer.flush();
      expect(entries).toHaveLength(maxSize);
      expect(entries[0].lineNumber).toBe(0);
      expect(entries[maxSize - 1].lineNumber).toBe(maxSize - 1);
    });
  });

  describe("flush", () => {
    it("should return empty array when buffer is empty", () => {
      const entries = buffer.flush();
      expect(entries).toEqual([]);
      expect(buffer.isEmpty()).toBe(true);
    });

    it("should return all entries and clear buffer", () => {
      const entry1 = createMockEntry(1);
      const entry2 = createMockEntry(2);
      const entry3 = createMockEntry(3);

      buffer.push(entry1);
      buffer.push(entry2);
      buffer.push(entry3);

      const entries = buffer.flush();
      expect(entries).toHaveLength(3);
      expect(entries[0]).toEqual(entry1);
      expect(entries[1]).toEqual(entry2);
      expect(entries[2]).toEqual(entry3);
      expect(buffer.isEmpty()).toBe(true);
    });

    it("should return shallow copy of buffer entries", () => {
      const entry = createMockEntry(1);
      buffer.push(entry);

      const entries = buffer.flush();

      // Buffer should be empty
      expect(buffer.isEmpty()).toBe(true);
      // Entries array should be a different array
      expect(entries).not.toBe(buffer.buffer);
      // But entries are the same objects (shallow copy is expected)
      expect(entries[0]).toBe(entry);
    });
  });

  describe("getStats", () => {
    it("should return correct stats for empty buffer", () => {
      const stats = buffer.getStats();
      expect(stats.currentSize).toBe(0);
      expect(stats.maxSize).toBe(maxSize);
      expect(stats.droppedCount).toBe(0);
      expect(stats.utilizationPercent).toBe(0);
    });

    it("should return correct stats for half-full buffer", () => {
      for (let i = 0; i < maxSize / 2; i++) {
        buffer.push(createMockEntry(i));
      }

      const stats = buffer.getStats();
      expect(stats.currentSize).toBe(maxSize / 2);
      expect(stats.maxSize).toBe(maxSize);
      expect(stats.droppedCount).toBe(0);
      expect(stats.utilizationPercent).toBe(50);
    });

    it("should return correct stats after drops", () => {
      // Fill buffer
      for (let i = 0; i < maxSize; i++) {
        buffer.push(createMockEntry(i));
      }

      // Cause some drops
      for (let i = 0; i < 3; i++) {
        buffer.push(createMockEntry(maxSize + i));
      }

      const stats = buffer.getStats();
      expect(stats.currentSize).toBe(maxSize);
      expect(stats.droppedCount).toBe(3);
      expect(stats.utilizationPercent).toBe(100);
    });
  });
});

describe("PriorityLogBuffer", () => {
  let buffer: PriorityLogBuffer;
  const maxSize = 100;
  const errorReserve = 0.1; // 10% for errors = 10 slots

  beforeEach(() => {
    buffer = new PriorityLogBuffer({
      maxSize,
      errorSlotReserve: errorReserve,
    });
  });

  function createMockEntry(lineNumber: number, level: LogLevel = "INFO"): BuildLogEntry {
    return {
      deploymentId: "test-deployment",
      lineNumber,
      timestamp: new Date(),
      level,
      message: `${level} log ${lineNumber}`,
      source: "BUILD",
    };
  }

  describe("initialization", () => {
    it("should create buffer with valid options", () => {
      expect(buffer.getMaxSize()).toBe(maxSize);
      expect(buffer["errorLimit"]).toBe(10);
      expect(buffer["generalLimit"]).toBe(90);
      expect(buffer.getLength()).toBe(0);
      expect(buffer.isEmpty()).toBe(true);
    });

    it("should throw error for non-positive maxSize", () => {
      expect(() => new PriorityLogBuffer({ maxSize: 0, errorSlotReserve: 0.1 })).toThrow(
        "PriorityLogBuffer maxSize must be positive"
      );
    });

    it("should throw error for invalid errorSlotReserve", () => {
      expect(() => new PriorityLogBuffer({ maxSize: 100, errorSlotReserve: -0.1 })).toThrow(
        "PriorityLogBuffer errorSlotReserve must be between 0 and 1"
      );
      expect(() => new PriorityLogBuffer({ maxSize: 100, errorSlotReserve: 1.5 })).toThrow(
        "PriorityLogBuffer errorSlotReserve must be between 0 and 1"
      );
    });

    it("should handle 0% error reserve", () => {
      const buf = new PriorityLogBuffer({ maxSize: 100, errorSlotReserve: 0 });
      expect(buf["errorLimit"]).toBe(0);
      expect(buf["generalLimit"]).toBe(100);
    });

    it("should handle 100% error reserve", () => {
      const buf = new PriorityLogBuffer({ maxSize: 100, errorSlotReserve: 1 });
      expect(buf["errorLimit"]).toBe(100);
      expect(buf["generalLimit"]).toBe(0);
    });
  });

  describe("ERROR log handling", () => {
    it("should always accept ERROR logs within error slot", () => {
      for (let i = 0; i < 10; i++) {
        const accepted = buffer.push(createMockEntry(i, "ERROR"));
        expect(accepted).toBe(true);
      }

      const stats = buffer.getStats();
      expect(stats.errorCount).toBe(10);
      expect(stats.droppedErrorCount).toBe(0);
    });

    it("should ring buffer ERROR logs when error slot is full", () => {
      // Fill error slot
      for (let i = 0; i < 10; i++) {
        buffer.push(createMockEntry(i, "ERROR"));
      }

      // Add more errors - should ring buffer
      for (let i = 10; i < 15; i++) {
        const accepted = buffer.push(createMockEntry(i, "ERROR"));
        expect(accepted).toBe(true);
      }

      const stats = buffer.getStats();
      expect(stats.errorCount).toBe(10); // Still at limit
      expect(stats.droppedErrorCount).toBe(5); // 5 errors dropped
    });

    it("should preserve most recent ERROR logs in ring buffer", () => {
      // Fill error slot
      for (let i = 0; i < 10; i++) {
        buffer.push(createMockEntry(i, "ERROR"));
      }

      // Add 3 more errors
      for (let i = 10; i < 13; i++) {
        buffer.push(createMockEntry(i, "ERROR"));
      }

      const entries = buffer.flush();
      const errorEntries = entries.filter((e) => e.level === "ERROR");

      expect(errorEntries).toHaveLength(10);
      expect(errorEntries[0].lineNumber).toBe(3); // First 3 were dropped
      expect(errorEntries[9].lineNumber).toBe(12); // Most recent kept
    });
  });

  describe("INFO/DEBUG log handling", () => {
    it("should accept INFO logs within general buffer", () => {
      for (let i = 0; i < 90; i++) {
        const accepted = buffer.push(createMockEntry(i, "INFO"));
        expect(accepted).toBe(true);
      }

      const stats = buffer.getStats();
      expect(stats.generalCount).toBe(90);
      expect(stats.droppedGeneralCount).toBe(0);
    });

    it("should reject INFO logs when general buffer is full", () => {
      // Fill general buffer
      for (let i = 0; i < 90; i++) {
        buffer.push(createMockEntry(i, "INFO"));
      }

      // Try to add more - should be rejected
      for (let i = 0; i < 5; i++) {
        const accepted = buffer.push(createMockEntry(90 + i, "INFO"));
        expect(accepted).toBe(false);
      }

      const stats = buffer.getStats();
      expect(stats.generalCount).toBe(90); // Still at limit
      expect(stats.droppedGeneralCount).toBe(5); // 5 dropped
    });

    it("should preserve all INFO logs when rejected (no ring buffer)", () => {
      // Fill general buffer
      for (let i = 0; i < 90; i++) {
        buffer.push(createMockEntry(i, "INFO"));
      }

      // Try to add more
      buffer.push(createMockEntry(90, "INFO"));
      buffer.push(createMockEntry(91, "INFO"));

      const entries = buffer.flush();
      const infoEntries = entries.filter((e) => e.level === "INFO");

      expect(infoEntries).toHaveLength(90);
      expect(infoEntries[0].lineNumber).toBe(0); // Original entries preserved
      expect(infoEntries[89].lineNumber).toBe(89);
    });
  });

  describe("mixed log levels", () => {
    it("should handle ERROR and INFO logs independently", () => {
      // Add mix of logs
      for (let i = 0; i < 10; i++) {
        buffer.push(createMockEntry(i, "ERROR"));
      }
      for (let i = 0; i < 90; i++) {
        buffer.push(createMockEntry(i + 100, "INFO"));
      }

      const stats = buffer.getStats();
      expect(stats.errorCount).toBe(10);
      expect(stats.generalCount).toBe(90);
      expect(stats.currentSize).toBe(100);
      expect(stats.droppedCount).toBe(0);
    });

    it("should allow ERROR logs even when general buffer is full", () => {
      // Fill general buffer
      for (let i = 0; i < 90; i++) {
        buffer.push(createMockEntry(i, "INFO"));
      }

      // General buffer full, but ERROR should still be accepted
      const accepted = buffer.push(createMockEntry(1, "ERROR"));
      expect(accepted).toBe(true);

      const stats = buffer.getStats();
      expect(stats.generalCount).toBe(90);
      expect(stats.errorCount).toBe(1);
    });

    it("should reject INFO logs even when error slot is empty", () => {
      // Fill general buffer
      for (let i = 0; i < 90; i++) {
        buffer.push(createMockEntry(i, "INFO"));
      }

      // General buffer full, error slot empty - INFO still rejected
      const accepted = buffer.push(createMockEntry(90, "INFO"));
      expect(accepted).toBe(false);
    });

    it("should maintain separate drop counts", () => {
      // Fill error slot and cause drops
      for (let i = 0; i < 15; i++) {
        buffer.push(createMockEntry(i, "ERROR"));
      }

      // Fill general buffer and cause drops
      for (let i = 0; i < 95; i++) {
        buffer.push(createMockEntry(i + 100, "INFO"));
      }

      const stats = buffer.getStats();
      expect(stats.droppedErrorCount).toBe(5);
      expect(stats.droppedGeneralCount).toBe(5);
      expect(stats.droppedCount).toBe(10);
    });
  });

  describe("flush", () => {
    it("should return entries in correct order (errors first, then general)", () => {
      // Add mix of logs interleaved
      buffer.push(createMockEntry(1, "INFO"));
      buffer.push(createMockEntry(2, "ERROR"));
      buffer.push(createMockEntry(3, "INFO"));
      buffer.push(createMockEntry(4, "ERROR"));

      const entries = buffer.flush();

      // Errors come first
      expect(entries[0].lineNumber).toBe(2);
      expect(entries[0].level).toBe("ERROR");
      expect(entries[1].lineNumber).toBe(4);
      expect(entries[1].level).toBe("ERROR");

      // Then general logs
      expect(entries[2].lineNumber).toBe(1);
      expect(entries[2].level).toBe("INFO");
      expect(entries[3].lineNumber).toBe(3);
      expect(entries[3].level).toBe("INFO");
    });

    it("should clear both buffers after flush", () => {
      buffer.push(createMockEntry(1, "ERROR"));
      buffer.push(createMockEntry(2, "INFO"));

      buffer.flush();

      expect(buffer.isEmpty()).toBe(true);
      expect(buffer.getLength()).toBe(0);
    });
  });

  describe("getStats", () => {
    it("should return comprehensive statistics", () => {
      // Add some logs
      for (let i = 0; i < 5; i++) {
        buffer.push(createMockEntry(i, "ERROR"));
      }
      for (let i = 0; i < 10; i++) {
        buffer.push(createMockEntry(i + 100, "INFO"));
      }

      // Cause some drops
      for (let i = 0; i < 10; i++) {
        buffer.push(createMockEntry(i + 10, "ERROR"));
      }
      for (let i = 0; i < 100; i++) {
        buffer.push(createMockEntry(i + 200, "INFO"));
      }

      const stats = buffer.getStats();
      expect(stats.currentSize).toBe(100); // 10 errors + 90 general (dropped some)
      expect(stats.maxSize).toBe(100);
      expect(stats.errorCount).toBe(10);
      expect(stats.generalCount).toBe(90);
      expect(stats.errorLimit).toBe(10);
      expect(stats.generalLimit).toBe(90);
      expect(stats.droppedErrorCount).toBe(5);
      // We added 10 INFO logs (10/90), then 100 more INFO logs (110 total)
      // So 20 were dropped (110 - 90 = 20)
      expect(stats.droppedGeneralCount).toBe(20);
      expect(stats.droppedCount).toBe(25); // 5 errors + 20 general
      expect(stats.utilizationPercent).toBe(100);
    });
  });
});

describe("environment variable parsers", () => {
  describe("parseBufferSize", () => {
    it("should parse valid numeric values", () => {
      expect(parseBufferSize("500", 1000)).toBe(500);
      expect(parseBufferSize("2000", 1000)).toBe(2000);
    });

    it("should return default for undefined", () => {
      expect(parseBufferSize(undefined, 1000)).toBe(1000);
    });

    it("should return default for invalid values", () => {
      expect(parseBufferSize("not-a-number", 1000)).toBe(1000);
      expect(parseBufferSize("-100", 1000)).toBe(1000);
      expect(parseBufferSize("0", 1000)).toBe(1000);
    });
  });

  describe("parseDropStrategy", () => {
    it("should parse valid strategies", () => {
      expect(parseDropStrategy("ring", "reject")).toBe("ring");
      expect(parseDropStrategy("reject", "ring")).toBe("reject");
    });

    it("should return default for undefined", () => {
      expect(parseDropStrategy(undefined, "ring")).toBe("ring");
    });

    it("should return default for invalid values", () => {
      expect(parseDropStrategy("invalid", "ring")).toBe("ring");
      expect(parseDropStrategy("", "reject")).toBe("reject");
    });
  });

  describe("parseErrorSlotReserve", () => {
    it("should parse valid percentages", () => {
      expect(parseErrorSlotReserve("0.1", 0.2)).toBe(0.1);
      expect(parseErrorSlotReserve("0.5", 0.2)).toBe(0.5);
      expect(parseErrorSlotReserve("0", 0.2)).toBe(0);
      expect(parseErrorSlotReserve("1", 0.2)).toBe(1);
    });

    it("should return default for undefined", () => {
      expect(parseErrorSlotReserve(undefined, 0.1)).toBe(0.1);
    });

    it("should return default for invalid values", () => {
      expect(parseErrorSlotReserve("not-a-number", 0.1)).toBe(0.1);
      expect(parseErrorSlotReserve("-0.1", 0.1)).toBe(0.1);
      expect(parseErrorSlotReserve("1.5", 0.1)).toBe(0.1);
    });
  });
});
