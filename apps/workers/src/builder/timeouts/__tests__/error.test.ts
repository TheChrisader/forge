import { describe, it, expect } from "vitest";
import { OperationTimeoutError } from "../error.js";

describe("OperationTimeoutError", () => {
  it("should extend ForgeError", () => {
    const error = new OperationTimeoutError("Git clone", 30_000);

    expect(error).toBeInstanceOf(OperationTimeoutError);
    expect(error.name).toBe("OperationTimeoutError");
    expect(error.code).toBe("OPERATION_TIMEOUT");
    expect(error.statusCode).toBe(408);
    expect(error.message).toContain("Git clone");
    expect(error.message).toContain("30000ms");
  });

  it("should include context details", () => {
    const error = new OperationTimeoutError("Docker build", 120_000);

    expect(error.details).toEqual({
      operation: "Docker build",
      timeoutMs: 120_000,
    });
  });

  it("should work with various operations", () => {
    const operations = ["Git clone", "Framework detection", "Docker build"];
    const timeouts = [30_000, 15_000, 600_000];

    for (let i = 0; i < operations.length; i++) {
      const error = new OperationTimeoutError(operations[i], timeouts[i]);
      expect(error.message).toContain(operations[i]);
      expect(error.message).toContain(`${timeouts[i]}ms`);
    }
  });
});
