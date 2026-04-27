import { describe, it, expect, beforeEach, vi } from "vitest";
import { DockerRuntime } from "../docker";
import { PassThrough, Writable } from "node:stream";

function createMockRuntime(): DockerRuntime {
  const runtime = new DockerRuntime({ socketPath: "/mock/docker.sock" });
  (runtime as any).docker = {
    getContainer: vi.fn(),
    modem: { demuxStream: vi.fn(), delete: vi.fn() },
  };
  return runtime;
}

describe("DockerRuntime exec methods", () => {
  let runtime: DockerRuntime;
  let mockDocker: any;

  beforeEach(() => {
    runtime = createMockRuntime();
    mockDocker = (runtime as any).docker;
  });

  describe("exec", () => {
    it("creates exec with command and starts it", async () => {
      const mockStream = new PassThrough();
      const mockExec = {
        start: vi.fn().mockImplementation(() => {
          // Allow demuxStream and event listeners to be set up, then emit end
          setImmediate(() => mockStream.emit("end"));
          return mockStream;
        }),
        inspect: vi.fn().mockResolvedValue({ ExitCode: 0 }),
      };
      const mockContainer = {
        exec: vi.fn().mockResolvedValue(mockExec),
      };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const result = await runtime.exec("c-1", ["ls", "-la"]);

      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({ Cmd: ["ls", "-la"] })
      );
      expect(mockExec.start).toHaveBeenCalled();
      expect(result.exitCode).toBe(0);
    });

    it("returns exitCode and output from non-tty mode", async () => {
      const stdoutData = Buffer.from("file1.txt\nfile2.txt\n");
      const stderrData = Buffer.from("");

      // Capture the stream that start() returns so we can emit data
      let capturedStream: PassThrough;
      const mockExec = {
        start: vi.fn().mockImplementation(() => {
          capturedStream = new PassThrough();
          // Manually emit data so we can control timing
          setImmediate(() => {
            mockDocker.modem.demuxStream(
              capturedStream,
              expect.any(Writable),
              expect.any(Writable)
            );
            // Simulate stdout data by calling the write callback of the stdout Writable
            // We need to intercept the Writable instances passed to demuxStream
            setImmediate(() => {
              const demuxCall = mockDocker.modem.demuxStream.mock.calls[0];
              const stdoutWritable = demuxCall[1];
              const stderrWritable = demuxCall[2];
              stdoutWritable.write(stdoutData);
              stderrWritable.write(stderrData);
              capturedStream.emit("end");
            });
          });
          return Promise.resolve(capturedStream);
        }),
        inspect: vi.fn().mockResolvedValue({ ExitCode: 0 }),
      };
      const mockContainer = { exec: vi.fn().mockResolvedValue(mockExec) };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const result = await runtime.exec("c-1", ["ls"]);

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain("file1.txt");
      expect(result.output).toContain("file2.txt");
    });

    it("passes env, workingDir, user options", async () => {
      const mockStream = new PassThrough();
      const mockExec = {
        start: vi.fn().mockImplementation(() => {
          setImmediate(() => mockStream.emit("end"));
          return mockStream;
        }),
        inspect: vi.fn().mockResolvedValue({ ExitCode: 0 }),
      };
      const mockContainer = { exec: vi.fn().mockResolvedValue(mockExec) };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      await runtime.exec("c-1", ["node", "-v"], {
        env: ["NODE_ENV=test"],
        workingDir: "/app",
        user: "node",
      });

      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Env: ["NODE_ENV=test"],
          WorkingDir: "/app",
          User: "node",
        })
      );
    });
  });

  describe("execStream", () => {
    it("returns stdout PassThrough, stderr PassThrough, and wait promise", async () => {
      const mockStream = new PassThrough();
      const mockExec = {
        start: vi.fn().mockResolvedValue(mockStream),
        inspect: vi.fn().mockResolvedValue({ ExitCode: 0 }),
      };
      const mockContainer = { exec: vi.fn().mockResolvedValue(mockExec) };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const result = await runtime.execStream("c-1", ["ls"]);

      expect(result.stdout).toBeInstanceOf(PassThrough);
      expect(result.stderr).toBeInstanceOf(PassThrough);
      expect(result.wait).toBeInstanceOf(Promise);

      // Trigger end of stream
      mockStream.emit("end");

      const waitResult = await result.wait;
      expect(waitResult.exitCode).toBe(0);
    });

    it("demuxes stream into stdout and stderr", async () => {
      const mockStream = new PassThrough();
      const mockExec = {
        start: vi.fn().mockImplementation(() => {
          // After start resolves, demuxStream is called with stdout/stderr
          setImmediate(() => {
            const demuxCall = mockDocker.modem.demuxStream.mock.calls[0];
            if (demuxCall) {
              // Emit end on the source stream to trigger wait resolution
              mockStream.emit("end");
            }
          });
          return mockStream;
        }),
        inspect: vi.fn().mockResolvedValue({ ExitCode: 0 }),
      };
      const mockContainer = { exec: vi.fn().mockResolvedValue(mockExec) };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const result = await runtime.execStream("c-1", ["ls"]);

      expect(mockDocker.modem.demuxStream).toHaveBeenCalledWith(
        mockStream,
        result.stdout,
        result.stderr
      );

      mockStream.emit("end");
      await result.wait;
    });
  });

  describe("interactiveExec", () => {
    it("creates exec with TTY and shell defaults to /bin/bash", async () => {
      const mockStream = new PassThrough();
      const mockExec = {
        id: "exec-123",
        start: vi.fn().mockResolvedValue(mockStream),
        inspect: vi.fn().mockResolvedValue({ Running: false }),
        resize: vi.fn().mockResolvedValue(undefined),
      };
      const mockContainer = { exec: vi.fn().mockResolvedValue(mockExec), modem: mockDocker.modem };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const session = await runtime.interactiveExec("c-1");

      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          AttachStdin: true,
          AttachStdout: true,
          Tty: true,
          Cmd: ["/bin/bash"],
        })
      );

      expect(session.id).toBe("exec-123");
      expect(session.output).toBe(mockStream);
      expect(typeof session.write).toBe("function");
      expect(typeof session.resize).toBe("function");
      expect(typeof session.kill).toBe("function");
      expect(session.onExit).toBeInstanceOf(Promise);
    });

    it("sets default env: TERM, COLUMNS, LINES", async () => {
      const mockStream = new PassThrough();
      const mockExec = {
        id: "exec-1",
        start: vi.fn().mockResolvedValue(mockStream),
        inspect: vi.fn().mockResolvedValue({ Running: false }),
        resize: vi.fn().mockResolvedValue(undefined),
      };
      const mockContainer = { exec: vi.fn().mockResolvedValue(mockExec), modem: mockDocker.modem };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      await runtime.interactiveExec("c-1");

      const execArgs = mockContainer.exec.mock.calls[0][0];
      expect(execArgs.Env).toContain("TERM=xterm-256color");
      expect(execArgs.Env).toContain("COLUMNS=80");
      expect(execArgs.Env).toContain("LINES=24");
    });

    it("write sends data to the stream", async () => {
      const mockStream = new PassThrough();
      const mockExec = {
        id: "exec-1",
        start: vi.fn().mockResolvedValue(mockStream),
        inspect: vi.fn().mockResolvedValue({ Running: false }),
        resize: vi.fn().mockResolvedValue(undefined),
      };
      const mockContainer = { exec: vi.fn().mockResolvedValue(mockExec), modem: mockDocker.modem };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const session = await runtime.interactiveExec("c-1");
      session.write(Buffer.from("ls\n"));

      // If stream isn't destroyed, write should succeed silently
      expect(mockStream.destroyed).toBe(false);
    });

    it("resize calls exec.resize with new dimensions", async () => {
      const mockStream = new PassThrough();
      const mockExec = {
        id: "exec-1",
        start: vi.fn().mockResolvedValue(mockStream),
        inspect: vi.fn().mockResolvedValue({ Running: false }),
        resize: vi.fn().mockResolvedValue(undefined),
      };
      const mockContainer = { exec: vi.fn().mockResolvedValue(mockExec), modem: mockDocker.modem };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const session = await runtime.interactiveExec("c-1");
      await session.resize(50, 120);

      expect(mockExec.resize).toHaveBeenCalledWith({ h: 50, w: 120 });
    });

    it("kill destroys the stream", async () => {
      const mockStream = new PassThrough();
      const mockExec = {
        id: "exec-1",
        start: vi.fn().mockResolvedValue(mockStream),
        inspect: vi.fn().mockResolvedValue({ Running: false }),
        resize: vi.fn().mockResolvedValue(undefined),
      };
      const mockContainer = { exec: vi.fn().mockResolvedValue(mockExec), modem: mockDocker.modem };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const session = await runtime.interactiveExec("c-1");
      await session.kill();

      expect(mockStream.destroyed).toBe(true);
    });

    it("onExit resolves with exitCode when stream ends", async () => {
      const mockStream = new PassThrough();
      const mockExec = {
        id: "exec-1",
        start: vi.fn().mockResolvedValue(mockStream),
        inspect: vi.fn().mockResolvedValue({ ExitCode: 0 }),
        resize: vi.fn().mockResolvedValue(undefined),
      };
      const mockContainer = { exec: vi.fn().mockResolvedValue(mockExec), modem: mockDocker.modem };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const session = await runtime.interactiveExec("c-1");

      // Emit end to trigger onExit resolution
      mockStream.emit("end");

      const exitResult = await session.onExit;
      expect(exitResult.exitCode).toBe(0);
    });

    it("uses custom shell from options", async () => {
      const mockStream = new PassThrough();
      const mockExec = {
        id: "exec-1",
        start: vi.fn().mockResolvedValue(mockStream),
        inspect: vi.fn().mockResolvedValue({ Running: false }),
        resize: vi.fn().mockResolvedValue(undefined),
      };
      const mockContainer = { exec: vi.fn().mockResolvedValue(mockExec), modem: mockDocker.modem };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      await runtime.interactiveExec("c-1", { shell: "/bin/sh" });

      const execArgs = mockContainer.exec.mock.calls[0][0];
      expect(execArgs.Cmd).toEqual(["/bin/sh"]);
    });

    it("uses custom rows and cols from options", async () => {
      const mockStream = new PassThrough();
      const mockExec = {
        id: "exec-1",
        start: vi.fn().mockResolvedValue(mockStream),
        inspect: vi.fn().mockResolvedValue({ Running: false }),
        resize: vi.fn().mockResolvedValue(undefined),
      };
      const mockContainer = { exec: vi.fn().mockResolvedValue(mockExec), modem: mockDocker.modem };
      mockDocker.getContainer.mockReturnValue(mockContainer);

      await runtime.interactiveExec("c-1", { rows: 40, cols: 200 });

      const execArgs = mockContainer.exec.mock.calls[0][0];
      expect(execArgs.Env).toContain("COLUMNS=200");
      expect(execArgs.Env).toContain("LINES=40");
    });
  });
});
