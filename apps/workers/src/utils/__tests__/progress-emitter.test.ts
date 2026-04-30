import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IJobContext } from "@forge/queue";
import { emitProgress, initializeLineNumberRef } from "../../utils/progress-emitter.js";

const { mockBuildLogService } = vi.hoisted(() => ({
  mockBuildLogService: {
    getLineCount: vi.fn().mockResolvedValue(42),
    appendBatch: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("emitProgress", () => {
  const mockLogBuffer = {
    push: vi.fn().mockReturnValue(true),
    getStats: vi.fn().mockReturnValue({ utilizationPercent: 50, droppedCount: 0 }),
  };

  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
  };

  const mockContext: IJobContext<unknown> = {
    job: {
      id: "job-1",
      name: "test",
      data: {},
      progress: 0,
      attemptsMade: 0,
      timestamp: Date.now(),
      opts: {},
    },
    updateProgress: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogBuffer.push.mockReturnValue(true);
  });

  it("should emit progress to BullMQ context", async () => {
    const lineRef = { value: 0 };

    await emitProgress(
      mockContext,
      "deploy-123",
      mockLogBuffer as any,
      lineRef,
      "DEPLOY",
      mockLogger as any,
      { message: "Building image..." }
    );

    expect(mockContext.updateProgress).toHaveBeenCalledWith({
      type: "deployment.log",
      deploymentId: "deploy-123",
      data: expect.objectContaining({
        lineNumber: 0,
        source: "DEPLOY",
        message: "Building image...",
      }),
    });
  });

  it("should increment lineNumber on each call", async () => {
    const lineRef = { value: 0 };

    await emitProgress(
      mockContext,
      "d-1",
      mockLogBuffer as any,
      lineRef,
      "BUILD",
      mockLogger as any,
      { message: "msg1" }
    );
    await emitProgress(
      mockContext,
      "d-1",
      mockLogBuffer as any,
      lineRef,
      "BUILD",
      mockLogger as any,
      { message: "msg2" }
    );

    const calls = mockContext.updateProgress.mock.calls;
    expect(calls[0][0].data.lineNumber).toBe(0);
    expect(calls[1][0].data.lineNumber).toBe(1);
    expect(lineRef.value).toBe(2);
  });

  it("should push to log buffer", async () => {
    const lineRef = { value: 0 };

    await emitProgress(
      mockContext,
      "d-1",
      mockLogBuffer as any,
      lineRef,
      "BUILD",
      mockLogger as any,
      { message: "test" }
    );

    expect(mockLogBuffer.push).toHaveBeenCalledWith(
      expect.objectContaining({
        deploymentId: "d-1",
        lineNumber: 0,
        message: "test",
        source: "BUILD",
      })
    );
  });

  it("should log to console by default", async () => {
    const lineRef = { value: 0 };

    await emitProgress(
      mockContext,
      "d-1",
      mockLogBuffer as any,
      lineRef,
      "BUILD",
      mockLogger as any,
      { message: "test" }
    );

    expect(mockLogger.info).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({ deploymentId: "d-1" })
    );
  });

  it("should not log to console when log is false", async () => {
    const lineRef = { value: 0 };

    await emitProgress(
      mockContext,
      "d-1",
      mockLogBuffer as any,
      lineRef,
      "BUILD",
      mockLogger as any,
      {
        message: "test",
        log: false,
      }
    );

    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it("should warn when log buffer rejects entry", async () => {
    mockLogBuffer.push.mockReturnValueOnce(false);
    const lineRef = { value: 0 };

    await emitProgress(
      mockContext,
      "d-1",
      mockLogBuffer as any,
      lineRef,
      "BUILD",
      mockLogger as any,
      { message: "test" }
    );

    expect(mockLogger.warn).toHaveBeenCalledWith(
      "Log dropped due to buffer full",
      expect.objectContaining({ deploymentId: "d-1" })
    );
  });
});

describe("initializeLineNumberRef", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize ref from existing log count", async () => {
    const ref = await initializeLineNumberRef(mockBuildLogService, "deploy-123");

    expect(mockBuildLogService.getLineCount).toHaveBeenCalledWith("deploy-123");
    expect(ref.value).toBe(42);
  });

  it("should start at 0 when no logs exist", async () => {
    mockBuildLogService.getLineCount.mockResolvedValueOnce(0);

    const ref = await initializeLineNumberRef(mockBuildLogService, "deploy-123");

    expect(ref.value).toBe(0);
  });
});
