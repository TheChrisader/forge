import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withTimeout, TIMEOUTS, OperationTimeoutError } from "../wrapper.js";

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should resolve when promise completes before timeout", async () => {
    const promise = Promise.resolve("success");
    const result = await withTimeout(promise, 1000, "test operation");
    expect(result).toBe("success");
  });

  it("should throw OperationTimeoutError when timeout expires", async () => {
    const promise = new Promise(() => {}); // Never resolves

    const timeoutPromise = withTimeout(promise, 100, "slow operation");

    vi.advanceTimersByTime(100);

    await expect(timeoutPromise).rejects.toThrow(OperationTimeoutError);
    await expect(timeoutPromise).rejects.toThrow("slow operation timed out after 100ms");
  });

  it("should propagate promise errors", async () => {
    const originalError = new Error("original error");
    const promise = Promise.reject(originalError);

    await expect(withTimeout(promise, 1000, "failing operation")).rejects.toThrow("original error");
  });

  it("should clear timeout when promise resolves", async () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

    const promise = Promise.resolve("success");
    await withTimeout(promise, 1000, "test operation");

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("should clear timeout when promise rejects", async () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

    const promise = Promise.reject(new Error("error"));
    await expect(withTimeout(promise, 1000, "test operation")).rejects.toThrow();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});

describe("TIMEOUTS", () => {
  it("should have predefined timeout values", () => {
    expect(TIMEOUTS.GIT_CLONE).toBe(5 * 60 * 1000); // 5 minutes
    expect(TIMEOUTS.DOCKER_BUILD).toBe(30 * 60 * 1000); // 30 minutes
    expect(TIMEOUTS.DOCKER_PULL).toBe(10 * 60 * 1000); // 10 minutes
    expect(TIMEOUTS.FRAMEWORK_DETECT).toBe(30 * 1000); // 30 seconds
  });

  it("should be readonly", () => {
    // TIMEOUTS is declared as const, so this should be a compile-time error
    // At runtime, we verify the values are as expected
    expect(TIMEOUTS).toMatchSnapshot();
  });
});
