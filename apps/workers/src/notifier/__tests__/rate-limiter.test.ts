import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NotificationRateLimiter } from "../rate-limiter.js";

describe("NotificationRateLimiter", () => {
  let limiter: NotificationRateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new NotificationRateLimiter(3, 1000);
  });

  afterEach(() => {
    limiter.destroy();
    vi.useRealTimers();
  });

  it("should allow notifications under the limit", () => {
    expect(limiter.isAllowed("channel-1")).toBe(true);
    expect(limiter.isAllowed("channel-1")).toBe(true);
    expect(limiter.isAllowed("channel-1")).toBe(true);
  });

  it("should block notifications when limit is reached", () => {
    limiter.isAllowed("channel-1");
    limiter.isAllowed("channel-1");
    limiter.isAllowed("channel-1");

    expect(limiter.isAllowed("channel-1")).toBe(false);
    expect(limiter.isAllowed("channel-1")).toBe(false);
  });

  it("should track channels independently", () => {
    // Fill channel-1
    limiter.isAllowed("channel-1");
    limiter.isAllowed("channel-1");
    limiter.isAllowed("channel-1");

    // channel-1 should be blocked
    expect(limiter.isAllowed("channel-1")).toBe(false);

    // channel-2 should still be allowed
    expect(limiter.isAllowed("channel-2")).toBe(true);
    expect(limiter.isAllowed("channel-2")).toBe(true);
    expect(limiter.isAllowed("channel-2")).toBe(true);
    expect(limiter.isAllowed("channel-2")).toBe(false);
  });

  it("should allow notifications after the window expires", () => {
    limiter.isAllowed("channel-1");
    limiter.isAllowed("channel-1");
    limiter.isAllowed("channel-1");

    expect(limiter.isAllowed("channel-1")).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(1100);

    expect(limiter.isAllowed("channel-1")).toBe(true);
  });

  it("should use default configuration when none provided", () => {
    const defaultLimiter = new NotificationRateLimiter();

    // Default: 20 per 60_000ms window
    for (let i = 0; i < 20; i++) {
      expect(defaultLimiter.isAllowed("channel-x")).toBe(true);
    }
    expect(defaultLimiter.isAllowed("channel-x")).toBe(false);

    defaultLimiter.destroy();
  });

  it("should allow new channel after window even without destroy", () => {
    limiter.isAllowed("ch");
    limiter.isAllowed("ch");
    limiter.isAllowed("ch");
    expect(limiter.isAllowed("ch")).toBe(false);

    vi.advanceTimersByTime(1001);
    expect(limiter.isAllowed("ch")).toBe(true);
  });

  describe("destroy", () => {
    it("should clear all state on destroy", () => {
      limiter.isAllowed("channel-1");
      limiter.isAllowed("channel-1");
      limiter.isAllowed("channel-1");

      limiter.destroy();

      // After destroy and re-creation, should start fresh
      const newLimiter = new NotificationRateLimiter(3, 1000);
      expect(newLimiter.isAllowed("channel-1")).toBe(true);
      expect(newLimiter.isAllowed("channel-1")).toBe(true);
      expect(newLimiter.isAllowed("channel-1")).toBe(true);
      expect(newLimiter.isAllowed("channel-1")).toBe(false);
      newLimiter.destroy();
    });
  });
});
