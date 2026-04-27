import { describe, it, expect, vi, beforeEach } from "vitest";
import { DockerRuntime } from "../docker.js";
import { Readable } from "node:stream";

describe("DockerRuntime.logs - log parsing", () => {
  let runtime: DockerRuntime;
  let mockDocker: any;
  let mockContainer: any;

  beforeEach(() => {
    mockContainer = {
      logs: vi.fn(),
    };

    mockDocker = {
      getContainer: vi.fn((): typeof mockContainer => mockContainer),
    };

    runtime = new DockerRuntime({ socketPath: "/mock/docker.sock" });
    (runtime as any).docker = mockDocker;
  });

  describe("non-follow mode", () => {
    it("parses a single stdout log frame", async () => {
      // Docker log frame: [stream_type(1)][3 padding bytes][payload_length(4)][payload]
      const message = "Building...\n";
      const frame = Buffer.concat([
        Buffer.from([1]), // stdout = 1
        Buffer.from([0, 0, 0]), // 3 padding bytes
        Buffer.from([0, 0, 0, message.length]), // payload length as big-endian uint32
        Buffer.from(message),
      ]);

      mockContainer.logs.mockResolvedValue(frame);

      const logs: any[] = [];
      for await (const entry of runtime.logs("container-id", { follow: false })) {
        logs.push(entry);
      }

      expect(logs).toHaveLength(1);
      expect(logs[0].stream).toBe("stdout");
      expect(logs[0].message).toBe("Building...");
    });

    it("parses a single stderr log frame", async () => {
      const message = "Error: build failed\n";
      const frame = Buffer.concat([
        Buffer.from([2]), // stderr = 2
        Buffer.from([0, 0, 0]), // 3 padding bytes
        Buffer.from([0, 0, 0, message.length]),
        Buffer.from(message),
      ]);

      mockContainer.logs.mockResolvedValue(frame);

      const logs: any[] = [];
      for await (const entry of runtime.logs("container-id", { follow: false })) {
        logs.push(entry);
      }

      expect(logs).toHaveLength(1);
      expect(logs[0].stream).toBe("stderr");
      expect(logs[0].message).toBe("Error: build failed");
    });

    it("parses multiple log frames in one buffer", async () => {
      const msg1 = "Step 1/5: FROM node\n";
      const msg2 = "Step 2/5: WORKDIR /app\n";

      const frame1 = Buffer.concat([
        Buffer.from([1]),
        Buffer.from([0, 0, 0]), // 3 padding bytes
        Buffer.from([0, 0, 0, msg1.length]),
        Buffer.from(msg1),
      ]);

      const frame2 = Buffer.concat([
        Buffer.from([1]),
        Buffer.from([0, 0, 0]), // 3 padding bytes
        Buffer.from([0, 0, 0, msg2.length]),
        Buffer.from(msg2),
      ]);

      mockContainer.logs.mockResolvedValue(Buffer.concat([frame1, frame2]));

      const logs: any[] = [];
      for await (const entry of runtime.logs("container-id", { follow: false })) {
        logs.push(entry);
      }

      expect(logs).toHaveLength(2);
      expect(logs[0].message).toBe("Step 1/5: FROM node");
      expect(logs[1].message).toBe("Step 2/5: WORKDIR /app");
    });

    it("filters out empty lines", async () => {
      const message = "Line 1\n\n\nLine 2\n";
      const frame = Buffer.concat([
        Buffer.from([1]),
        Buffer.from([0, 0, 0]), // 3 padding bytes
        Buffer.from([0, 0, 0, message.length]),
        Buffer.from(message),
      ]);

      mockContainer.logs.mockResolvedValue(frame);

      const logs: any[] = [];
      for await (const entry of runtime.logs("container-id", { follow: false })) {
        logs.push(entry);
      }

      // Empty lines should be filtered out
      expect(logs).toHaveLength(2);
      expect(logs[0].message).toBe("Line 1");
      expect(logs[1].message).toBe("Line 2");
    });
  });

  describe("follow mode", () => {
    it("streams log frames as they arrive", async () => {
      // Readable imported at top of file

      const msg1 = "Starting build...\n";
      const msg2 = "Installing dependencies...\n";
      const msg3 = "Build complete\n";

      const frame1 = Buffer.concat([
        Buffer.from([1]),
        Buffer.from([0, 0, 0]), // 3 padding bytes
        Buffer.from([0, 0, 0, msg1.length]),
        Buffer.from(msg1),
      ]);

      const frame2 = Buffer.concat([
        Buffer.from([1]),
        Buffer.from([0, 0, 0]), // 3 padding bytes
        Buffer.from([0, 0, 0, msg2.length]),
        Buffer.from(msg2),
      ]);

      const frame3 = Buffer.concat([
        Buffer.from([1]),
        Buffer.from([0, 0, 0]), // 3 padding bytes
        Buffer.from([0, 0, 0, msg3.length]),
        Buffer.from(msg3),
      ]);

      const mockStream = Readable.from([frame1, frame2, frame3]);
      mockContainer.logs.mockResolvedValue(mockStream);

      const logs: any[] = [];
      for await (const entry of runtime.logs("container-id", { follow: true })) {
        logs.push(entry);
      }

      expect(logs).toHaveLength(3);
      expect(logs[0].message).toBe("Starting build...");
      expect(logs[1].message).toBe("Installing dependencies...");
      expect(logs[2].message).toBe("Build complete");
    });

    it("reassembles frames split across chunks", async () => {
      // Readable imported at top of file

      // Create a complete frame, then split it in half
      const message = "This is a long log message that spans chunks\n";
      const completeFrame = Buffer.concat([
        Buffer.from([1]),
        Buffer.from([0, 0, 0]), // 3 padding bytes
        Buffer.from([0, 0, 0, message.length]),
        Buffer.from(message),
      ]);

      // Split at an arbitrary point in the middle (after the 8-byte header)
      const chunk1 = completeFrame.subarray(0, 15);
      const chunk2 = completeFrame.subarray(15);

      const mockStream = Readable.from([chunk1, chunk2]);
      mockContainer.logs.mockResolvedValue(mockStream);

      const logs: any[] = [];
      for await (const entry of runtime.logs("container-id", { follow: true })) {
        logs.push(entry);
      }

      // Should reassemble into one complete log entry
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe("This is a long log message that spans chunks");
    });

    it("handles multiple complete frames followed by partial frame", async () => {
      // Readable imported at top of file

      const msg1 = "First message\n";
      const msg2 = "Second message\n";
      const partialMsg = "Partial message that continues";

      const frame1 = Buffer.concat([
        Buffer.from([1]),
        Buffer.from([0, 0, 0]), // 3 padding bytes
        Buffer.from([0, 0, 0, msg1.length]),
        Buffer.from(msg1),
      ]);

      const frame2 = Buffer.concat([
        Buffer.from([1]),
        Buffer.from([0, 0, 0]), // 3 padding bytes
        Buffer.from([0, 0, 0, msg2.length]),
        Buffer.from(msg2),
      ]);

      // Start of third frame, but cut off mid-payload
      const partialFrameStart = Buffer.concat([
        Buffer.from([1]),
        Buffer.from([0, 0, 0]), // 3 padding bytes
        Buffer.from([0, 0, 0, partialMsg.length]),
        Buffer.from(partialMsg.slice(0, 10)),
      ]);

      // Rest of third frame
      const partialFrameEnd = Buffer.from(partialMsg.slice(10) + "\n");

      const mockStream = Readable.from([frame1, frame2, partialFrameStart, partialFrameEnd]);
      mockContainer.logs.mockResolvedValue(mockStream);

      const logs: any[] = [];
      for await (const entry of runtime.logs("container-id", { follow: true })) {
        logs.push(entry);
      }

      expect(logs).toHaveLength(3);
      expect(logs[0].message).toBe("First message");
      expect(logs[1].message).toBe("Second message");
      expect(logs[2].message).toBe("Partial message that continues");
    });
  });

  describe("mixed stdout/stderr", () => {
    it("handles interleaved stdout and stderr frames", async () => {
      const stdoutMsg = "stdout output\n";
      const stderrMsg = "stderr error\n";

      const stdoutFrame = Buffer.concat([
        Buffer.from([1]),
        Buffer.from([0, 0, 0]), // 3 padding bytes
        Buffer.from([0, 0, 0, stdoutMsg.length]),
        Buffer.from(stdoutMsg),
      ]);

      const stderrFrame = Buffer.concat([
        Buffer.from([2]),
        Buffer.from([0, 0, 0]), // 3 padding bytes
        Buffer.from([0, 0, 0, stderrMsg.length]),
        Buffer.from(stderrMsg),
      ]);

      mockContainer.logs.mockResolvedValue(Buffer.concat([stdoutFrame, stderrFrame]));

      const logs: any[] = [];
      for await (const entry of runtime.logs("container-id", { follow: false })) {
        logs.push(entry);
      }

      expect(logs).toHaveLength(2);
      expect(logs[0].stream).toBe("stdout");
      expect(logs[0].message).toBe("stdout output");
      expect(logs[1].stream).toBe("stderr");
      expect(logs[1].message).toBe("stderr error");
    });
  });
});
