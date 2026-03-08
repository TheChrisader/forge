/**
 * Connection Limit Error
 *
 * Thrown when SSE connection limits are exceeded.
 * Distinguishes between per-topic limits and global limits.
 */

export class ConnectionLimitError extends Error {
  constructor(
    public readonly type: "per-topic" | "global",
    public readonly limit: number,
    public readonly current: number
  ) {
    super(
      type === "per-topic"
        ? `Maximum connections per topic reached (${limit})`
        : `Maximum total connections reached (${limit})`
    );
    this.name = "ConnectionLimitError";
  }
}
