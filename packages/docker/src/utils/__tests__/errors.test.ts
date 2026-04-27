import { describe, it, expect } from "vitest";
import {
  DockerRuntimeError,
  ContainerNotFoundError,
  ImageNotFoundError,
  ImagePullError,
  NetworkNotFoundError,
  VolumeNotFoundError,
  ContainerNotRunningError,
  HealthCheckTimeoutError,
  DockerConnectionError,
  DockerDaemonUnavailableError,
  BuildError,
  DockerSyntaxError,
  ExecError,
} from "../../errors";

describe("DockerRuntimeError", () => {
  it("sets name, message, code, and statusCode from constructor", () => {
    const error = new DockerRuntimeError("something went wrong", "TEST_ERROR", 500, { key: "val" });
    expect(error.name).toBe("DockerRuntimeError");
    expect(error.message).toBe("something went wrong");
    expect(error.code).toBe("TEST_ERROR");
    expect(error.statusCode).toBe(500);
    expect(error.details).toEqual({ key: "val" });
  });

  it("defaults statusCode to 500", () => {
    const error = new DockerRuntimeError("msg", "CODE");
    expect(error.statusCode).toBe(500);
  });

  it("defaults details to undefined", () => {
    const error = new DockerRuntimeError("msg", "CODE");
    expect(error.details).toBeUndefined();
  });

  it("serializes correctly via toJSON", () => {
    const error = new DockerRuntimeError("msg", "CODE", 404, { id: "1" });
    const json = error.toJSON();
    expect(json).toEqual({
      name: "DockerRuntimeError",
      message: "msg",
      code: "CODE",
      statusCode: 404,
      details: { id: "1" },
    });
  });

  it("is an instance of Error and DockerRuntimeError", () => {
    const error = new DockerRuntimeError("msg", "CODE");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DockerRuntimeError);
  });
});

describe("ContainerNotFoundError", () => {
  it("sets message, code, statusCode, and details", () => {
    const error = new ContainerNotFoundError("abc123");
    expect(error.name).toBe("ContainerNotFoundError");
    expect(error.message).toBe("Container not found: abc123");
    expect(error.code).toBe("CONTAINER_NOT_FOUND");
    expect(error.statusCode).toBe(404);
    expect(error.details).toEqual({ containerId: "abc123" });
  });

  it("is an instance of DockerRuntimeError", () => {
    expect(new ContainerNotFoundError("x")).toBeInstanceOf(DockerRuntimeError);
  });

  it("serializes via toJSON with containerId", () => {
    const json = new ContainerNotFoundError("x").toJSON();
    expect(json.details).toEqual({ containerId: "x" });
  });
});

describe("ImageNotFoundError", () => {
  it("sets message, code, statusCode, and details", () => {
    const error = new ImageNotFoundError("nginx:latest");
    expect(error.name).toBe("ImageNotFoundError");
    expect(error.message).toBe("Image not found: nginx:latest");
    expect(error.code).toBe("IMAGE_NOT_FOUND");
    expect(error.statusCode).toBe(404);
    expect(error.details).toEqual({ image: "nginx:latest" });
  });

  it("is an instance of DockerRuntimeError", () => {
    expect(new ImageNotFoundError("x")).toBeInstanceOf(DockerRuntimeError);
  });
});

describe("ImagePullError", () => {
  it("sets message, code, statusCode, and details", () => {
    const error = new ImagePullError("nginx:latest", "connection refused");
    expect(error.name).toBe("ImagePullError");
    expect(error.message).toBe("Failed to pull image nginx:latest: connection refused");
    expect(error.code).toBe("IMAGE_PULL_FAILED");
    expect(error.statusCode).toBe(500);
    expect(error.details).toEqual({ image: "nginx:latest", reason: "connection refused" });
  });

  it("is an instance of DockerRuntimeError", () => {
    expect(new ImagePullError("x", "r")).toBeInstanceOf(DockerRuntimeError);
  });
});

describe("NetworkNotFoundError", () => {
  it("sets message, code, statusCode, and details", () => {
    const error = new NetworkNotFoundError("net-123");
    expect(error.name).toBe("NetworkNotFoundError");
    expect(error.message).toBe("Network not found: net-123");
    expect(error.code).toBe("NETWORK_NOT_FOUND");
    expect(error.statusCode).toBe(404);
    expect(error.details).toEqual({ networkId: "net-123" });
  });

  it("is an instance of DockerRuntimeError", () => {
    expect(new NetworkNotFoundError("x")).toBeInstanceOf(DockerRuntimeError);
  });
});

describe("VolumeNotFoundError", () => {
  it("sets message, code, statusCode, and details", () => {
    const error = new VolumeNotFoundError("vol-data");
    expect(error.name).toBe("VolumeNotFoundError");
    expect(error.message).toBe("Volume not found: vol-data");
    expect(error.code).toBe("VOLUME_NOT_FOUND");
    expect(error.statusCode).toBe(404);
    expect(error.details).toEqual({ volumeName: "vol-data" });
  });

  it("is an instance of DockerRuntimeError", () => {
    expect(new VolumeNotFoundError("x")).toBeInstanceOf(DockerRuntimeError);
  });
});

describe("ContainerNotRunningError", () => {
  it("sets message, code, statusCode, and details", () => {
    const error = new ContainerNotRunningError("c1", "exited");
    expect(error.name).toBe("ContainerNotRunningError");
    expect(error.message).toBe("Container c1 is not running (status: exited)");
    expect(error.code).toBe("CONTAINER_NOT_RUNNING");
    expect(error.statusCode).toBe(409);
    expect(error.details).toEqual({ containerId: "c1", status: "exited" });
  });

  it("is an instance of DockerRuntimeError", () => {
    expect(new ContainerNotRunningError("c", "s")).toBeInstanceOf(DockerRuntimeError);
  });
});

describe("HealthCheckTimeoutError", () => {
  it("sets message, code, statusCode, and details", () => {
    const error = new HealthCheckTimeoutError("c1", 60000);
    expect(error.name).toBe("HealthCheckTimeoutError");
    expect(error.message).toBe("Container c1 did not become healthy within 60000ms");
    expect(error.code).toBe("HEALTH_CHECK_TIMEOUT");
    expect(error.statusCode).toBe(408);
    expect(error.details).toEqual({ containerId: "c1", timeout: 60000 });
  });

  it("is an instance of DockerRuntimeError", () => {
    expect(new HealthCheckTimeoutError("c", 1000)).toBeInstanceOf(DockerRuntimeError);
  });
});

describe("DockerConnectionError", () => {
  it("sets message, code, statusCode, and details", () => {
    const error = new DockerConnectionError("/var/run/docker.sock", "ECONNREFUSED");
    expect(error.name).toBe("DockerConnectionError");
    expect(error.message).toBe(
      "Cannot connect to Docker daemon at /var/run/docker.sock: ECONNREFUSED"
    );
    expect(error.code).toBe("DOCKER_CONNECTION_FAILED");
    expect(error.statusCode).toBe(503);
    expect(error.details).toEqual({ endpoint: "/var/run/docker.sock", reason: "ECONNREFUSED" });
  });

  it("is an instance of DockerRuntimeError", () => {
    expect(new DockerConnectionError("e", "r")).toBeInstanceOf(DockerRuntimeError);
  });
});

describe("DockerDaemonUnavailableError", () => {
  it("sets message, code, and statusCode", () => {
    const error = new DockerDaemonUnavailableError();
    expect(error.name).toBe("DockerDaemonUnavailableError");
    expect(error.message).toBe("Docker daemon is not running or not accessible");
    expect(error.code).toBe("DOCKER_DAEMON_UNAVAILABLE");
    expect(error.statusCode).toBe(503);
  });

  it("has no details", () => {
    const error = new DockerDaemonUnavailableError();
    expect(error.details).toBeUndefined();
  });

  it("is an instance of DockerRuntimeError", () => {
    expect(new DockerDaemonUnavailableError()).toBeInstanceOf(DockerRuntimeError);
  });
});

describe("BuildError", () => {
  it("sets message, code, statusCode, and details", () => {
    const error = new BuildError("/ctx", "no Dockerfile found");
    expect(error.name).toBe("BuildError");
    expect(error.message).toBe("Build failed for /ctx: no Dockerfile found");
    expect(error.code).toBe("BUILD_FAILED");
    expect(error.statusCode).toBe(500);
    expect(error.details).toEqual({ context: "/ctx", reason: "no Dockerfile found" });
  });

  it("is an instance of DockerRuntimeError", () => {
    expect(new BuildError("c", "r")).toBeInstanceOf(DockerRuntimeError);
  });
});

describe("DockerSyntaxError", () => {
  it("sets message, code, statusCode, and details", () => {
    const error = new DockerSyntaxError("unknown instruction: FOO");
    expect(error.name).toBe("DockerSyntaxError");
    expect(error.message).toBe("Dockerfile syntax error: unknown instruction: FOO");
    expect(error.code).toBe("DOCKERFILE_SYNTAX_ERROR");
    expect(error.statusCode).toBe(400);
    expect(error.details).toEqual({ message: "unknown instruction: FOO" });
  });

  it("is an instance of DockerRuntimeError", () => {
    expect(new DockerSyntaxError("m")).toBeInstanceOf(DockerRuntimeError);
  });
});

describe("ExecError", () => {
  it("sets message, code, statusCode, and details", () => {
    const error = new ExecError("c1", 1, "command not found: sh");
    expect(error.name).toBe("ExecError");
    expect(error.message).toBe("Exec command failed in container c1 with exit code 1");
    expect(error.code).toBe("EXEC_FAILED");
    expect(error.statusCode).toBe(500);
    expect(error.details).toEqual({
      containerId: "c1",
      exitCode: 1,
      output: "command not found: sh",
    });
  });

  it("is an instance of DockerRuntimeError", () => {
    expect(new ExecError("c", 0, "")).toBeInstanceOf(DockerRuntimeError);
  });
});
