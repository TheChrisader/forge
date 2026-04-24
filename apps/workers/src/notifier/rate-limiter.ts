export class NotificationRateLimiter {
  private readonly windows = new Map<string, number[]>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly maxNotifications = 20,
    private readonly windowMs = 60_000
  ) {
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60_000);
  }

  isAllowed(channelId: string): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    let timestamps = this.windows.get(channelId);

    if (!timestamps) {
      timestamps = [];
      this.windows.set(channelId, timestamps);
    }

    // Prune expired entries
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }

    if (timestamps.length >= this.maxNotifications) {
      return false;
    }

    timestamps.push(now);
    return true;
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.windowMs;
    for (const [channelId, timestamps] of this.windows) {
      while (timestamps.length > 0 && timestamps[0] < cutoff) {
        timestamps.shift();
      }
      if (timestamps.length === 0) {
        this.windows.delete(channelId);
      }
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.windows.clear();
  }
}
