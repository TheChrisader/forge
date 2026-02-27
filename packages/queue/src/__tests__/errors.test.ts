/**
 * Error class tests
 */

import { describe, it, expect } from "vitest";
import { QueueError, QueueConnectionError, QueueJobError } from "../errors";

describe("QueueError", () => {
  it("should create a queue error", () => {
    const error = new QueueError("Test error");

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Test error");
    expect(error.name).toBe("QueueError");
  });
});

describe("QueueConnectionError", () => {
  it("should create a connection error", () => {
    const cause = new Error("Underlying cause");
    const error = new QueueConnectionError("Connection failed", cause);

    expect(error).toBeInstanceOf(QueueError);
    expect(error.message).toBe("Connection failed");
    expect(error.name).toBe("QueueConnectionError");
    expect(error.cause).toBe(cause);
  });

  it("should be created without cause", () => {
    const error = new QueueConnectionError("Connection failed");

    expect(error.cause).toBeUndefined();
  });
});

describe("QueueJobError", () => {
  it("should create a job error with job ID", () => {
    const error = new QueueJobError("Job failed", "job-123");

    expect(error).toBeInstanceOf(QueueError);
    expect(error.message).toBe("Job failed");
    expect(error.name).toBe("QueueJobError");
    expect(error.jobId).toBe("job-123");
  });

  it("should be created without job ID", () => {
    const error = new QueueJobError("Job failed");

    expect(error.jobId).toBeUndefined();
  });
});
