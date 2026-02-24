export class DockerRuntimeError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = "DockerRuntimeError";
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): {
    name: string;
    message: string;
    code: string;
    statusCode: number;
    details: unknown;
  } {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

export class ContainerNotFoundError extends DockerRuntimeError {
  constructor(id: string) {
    super(`Container not found: ${id}`, "CONTAINER_NOT_FOUND", 404, { containerId: id });
    this.name = "ContainerNotFoundError";
  }
}

export class ImageNotFoundError extends DockerRuntimeError {
  constructor(image: string) {
    super(`Image not found: ${image}`, "IMAGE_NOT_FOUND", 404, { image });
    this.name = "ImageNotFoundError";
  }
}

export class ImagePullError extends DockerRuntimeError {
  constructor(image: string, reason: string) {
    super(`Failed to pull image ${image}: ${reason}`, "IMAGE_PULL_FAILED", 500, { image, reason });
    this.name = "ImagePullError";
  }
}

export class NetworkNotFoundError extends DockerRuntimeError {
  constructor(id: string) {
    super(`Network not found: ${id}`, "NETWORK_NOT_FOUND", 404, { networkId: id });
    this.name = "NetworkNotFoundError";
  }
}

export class VolumeNotFoundError extends DockerRuntimeError {
  constructor(name: string) {
    super(`Volume not found: ${name}`, "VOLUME_NOT_FOUND", 404, { volumeName: name });
    this.name = "VolumeNotFoundError";
  }
}

export class ContainerNotRunningError extends DockerRuntimeError {
  constructor(id: string, status: string) {
    super(`Container ${id} is not running (status: ${status})`, "CONTAINER_NOT_RUNNING", 409, {
      containerId: id,
      status,
    });
    this.name = "ContainerNotRunningError";
  }
}

export class HealthCheckTimeoutError extends DockerRuntimeError {
  constructor(id: string, timeout: number) {
    super(
      `Container ${id} did not become healthy within ${timeout}ms`,
      "HEALTH_CHECK_TIMEOUT",
      408,
      { containerId: id, timeout }
    );
    this.name = "HealthCheckTimeoutError";
  }
}

export class DockerConnectionError extends DockerRuntimeError {
  constructor(endpoint: string, reason: string) {
    super(
      `Cannot connect to Docker daemon at ${endpoint}: ${reason}`,
      "DOCKER_CONNECTION_FAILED",
      503,
      { endpoint, reason }
    );
    this.name = "DockerConnectionError";
  }
}

export class DockerDaemonUnavailableError extends DockerRuntimeError {
  constructor() {
    super("Docker daemon is not running or not accessible", "DOCKER_DAEMON_UNAVAILABLE", 503);
    this.name = "DockerDaemonUnavailableError";
  }
}

export class BuildError extends DockerRuntimeError {
  constructor(context: string, reason: string) {
    super(`Build failed for ${context}: ${reason}`, "BUILD_FAILED", 500, { context, reason });
    this.name = "BuildError";
  }
}

export class DockerSyntaxError extends DockerRuntimeError {
  constructor(message: string) {
    super(`Dockerfile syntax error: ${message}`, "DOCKERFILE_SYNTAX_ERROR", 400, { message });
    this.name = "DockerSyntaxError";
  }
}

export class ExecError extends DockerRuntimeError {
  constructor(id: string, exitCode: number, output: string) {
    super(`Exec command failed in container ${id} with exit code ${exitCode}`, "EXEC_FAILED", 500, {
      containerId: id,
      exitCode,
      output,
    });
    this.name = "ExecError";
  }
}
