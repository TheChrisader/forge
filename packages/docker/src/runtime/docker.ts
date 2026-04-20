import Docker, { ImageRemoveInfo, PruneImagesInfo } from "dockerode";
import { PassThrough, Writable } from "node:stream";
import { parseDockerImage } from "../utils/image-parser";
import { DockerIgnoreFilter, createDefaultIgnore } from "../utils/dockerignore";
import type {
  IContainerRuntime,
  Container,
  ContainerConfig,
  ContainerInfo,
  ContainerFilters,
  ContainerStatus,
  StopOptions,
  RemoveOptions,
  ExecOptions,
  ExecResult,
  ExecStreamResult,
  LogOptions,
  LogEntry,
  ContainerStats,
  ContainerEvent,
  EventFilters,
  Network,
  NetworkConfig,
  NetworkConnectConfig,
  NetworkFilters,
  Volume,
  VolumeConfig,
  VolumeFilters,
  Image,
  ImageFilters,
  PullOptions,
  BuildOptions,
  BuildResult,
  RemoveImageOptions,
  DockerConnectionOptions,
  HealthCheckResult,
  WaitOptions,
  DockerSystemInfo,
  PullProgress,
  BuildProgress,
  NetworkEndpoint,
  ContainerHealthStatus,
  InteractiveExecOptions,
  InteractiveExecSession,
} from "../interfaces/runtime";
import {
  DockerRuntimeError,
  ContainerNotRunningError,
  HealthCheckTimeoutError,
  DockerConnectionError,
  BuildError,
  DockerSyntaxError,
} from "../errors";

const DEFAULT_SOCKET_PATHS = {
  win32: "//./pipe/docker_engine",
  darwin: "/var/run/docker.sock",
  linux: "/var/run/docker.sock",
} as const;

const DEFAULT_EXTRA_HOST = "host.docker.internal:host-gateway";

function getDefaultSocketPath(): string {
  return (
    DEFAULT_SOCKET_PATHS[process.platform as keyof typeof DEFAULT_SOCKET_PATHS] ||
    DEFAULT_SOCKET_PATHS.linux
  );
}

export class DockerRuntime implements IContainerRuntime {
  private docker: Docker;
  private connectionOptions: DockerConnectionOptions;

  constructor(options?: DockerConnectionOptions) {
    this.connectionOptions = this.normalizeOptions(options);
    this.docker = this.createDockerClient(this.connectionOptions);
  }

  private normalizeOptions(options?: DockerConnectionOptions): DockerConnectionOptions {
    const mode = options?.mode || (options?.host ? "http" : "socket");

    if (mode === "http") {
      return {
        mode: "http",
        host: options?.host || process.env.DOCKER_HOST || "localhost",
        port: options?.port || parseInt(process.env.DOCKER_PORT || "2375", 10),
        protocol: options?.protocol || "http",
        certPath: options?.certPath,
        ca: options?.ca,
        key: options?.key,
        timeout: options?.timeout || 30000,
      };
    }

    return {
      mode: "socket",
      socketPath: options?.socketPath || getDefaultSocketPath(),
      timeout: options?.timeout || 30000,
    };
  }

  private createDockerClient(options: DockerConnectionOptions): Docker {
    try {
      if (options.mode === "http" && options.host) {
        return new Docker({
          host: options.host,
          port: options.port,
          protocol: options.protocol,
          ca: options.ca,
          cert: options.certPath,
          key: options.key,
          timeout: options.timeout,
        });
      }

      return new Docker({
        socketPath: options.socketPath || getDefaultSocketPath(),
        timeout: options.timeout,
      });
    } catch (error) {
      const endpoint =
        options.mode === "http"
          ? `${options.protocol}://${options.host}:${options.port}`
          : options.socketPath || getDefaultSocketPath();

      throw new DockerConnectionError(
        endpoint,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const info = (await this.docker.info()) as DockerSystemInfo;

      return {
        healthy: true,
        version: info.ServerVersion,
        os: info.OperatingSystem,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async waitForHealthy(id: string, options?: WaitOptions): Promise<void> {
    const timeout = options?.timeout || 120000;
    const interval = options?.interval || 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (options?.signal?.aborted) {
        throw new DockerRuntimeError("Wait aborted", "WAIT_ABORTED", 499);
      }

      try {
        const info = await this.inspect(id);

        if (info.health?.status === "healthy") {
          return;
        }

        if (info.health?.status === "unhealthy") {
          throw new DockerRuntimeError(`Container ${id} is unhealthy`, "CONTAINER_UNHEALTHY", 409, {
            containerId: id,
            health: info.health,
          });
        }

        if (info.state.running && !info.health) {
          // maybe throw a warning? will need to also add the option
          // to turn it off...
          return;
        }
      } catch (error) {
        if (error instanceof DockerRuntimeError) {
          throw error;
        }
      }

      await this.sleep(interval);
    }

    throw new HealthCheckTimeoutError(id, timeout);
  }

  async waitForState(id: string, state: ContainerStatus, options?: WaitOptions): Promise<void> {
    const timeout = options?.timeout || 60000;
    const interval = options?.interval || 1000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (options?.signal?.aborted) {
        throw new DockerRuntimeError("Wait aborted", "WAIT_ABORTED", 499);
      }

      try {
        const container = await this.docker.getContainer(id).inspect();
        const status = this.mapStatus(container.State.Status);

        if (status === state) {
          return;
        }

        if (status === "dead" || status === "exited") {
          throw new ContainerNotRunningError(id, status);
        }
      } catch (error) {
        if (error instanceof DockerRuntimeError) {
          throw error;
        }
      }

      await this.sleep(interval);
    }

    throw new DockerRuntimeError(
      `Container ${id} did not reach state ${state} within timeout`,
      "WAIT_STATE_TIMEOUT",
      408,
      { containerId: id, expectedState: state, timeout }
    );
  }

  private async ensureImage(imageRef: string, options?: PullOptions): Promise<void> {
    try {
      await this.docker.getImage(imageRef).inspect();
    } catch {
      const parsed = parseDockerImage(imageRef);

      await this.pullImage(parsed.repository, {
        tag: options?.tag || parsed.tag || undefined,
        onProgress: undefined,
        ...options,
      });
    }
    // TODO: Local images may be stale (especially :latest tags)
    // Thinking about adding force-pull option for production deployments
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async create(config: ContainerConfig): Promise<Container> {
    await this.ensureImage(config.image);

    // Resolve networks: prefer new `networks` array, fall back to legacy `network` string
    const resolvedNetworks =
      config.networks ??
      (config.network ? [{ name: config.network, aliases: config.networkAliases }] : []);
    const primaryNetwork = resolvedNetworks[0]?.name;

    // Build ExposedPorts from config.ports so Traefik and other tools can discover them
    const exposedPorts = this.buildExposedPorts(config.ports);

    // Build EndpointsConfig for all networks
    const endpointsConfig: Docker.EndpointsConfig | undefined =
      resolvedNetworks.length > 0
        ? Object.fromEntries(resolvedNetworks.map((net) => [net.name, { Aliases: net.aliases }]))
        : undefined;

    const createOptions: Docker.ContainerCreateOptions = {
      name: config.name,
      Image: config.image,
      Cmd: config.cmd,
      Entrypoint: config.entrypoint,
      Env: config.env ? Object.entries(config.env).map(([k, v]) => `${k}=${v}`) : undefined,
      Labels: config.labels,
      ExposedPorts: exposedPorts,
      WorkingDir: config.workingDir,
      User: config.user,
      HostConfig: {
        AutoRemove: config.autoRemove,
        CapAdd: config.capabilities?.add ?? [],
        CapDrop: config.capabilities?.drop ?? [],
        ExtraHosts: config.extraHosts ?? [DEFAULT_EXTRA_HOST],
        RestartPolicy: config.restartPolicy
          ? {
              Name: config.restartPolicy.name,
              MaximumRetryCount: config.restartPolicy.maximumRetryCount,
            }
          : undefined,
        ReadonlyRootfs: config.readOnly,
        Memory: config.resources?.memory ? this.parseMemory(config.resources.memory) : undefined,
        MemoryReservation: config.resources?.memoryReservation
          ? this.parseMemory(config.resources.memoryReservation)
          : undefined,
        NanoCpus: config.resources?.cpus ? config.resources.cpus * 1e9 : undefined,
        CpuShares: config.resources?.cpuShares,
        PortBindings: this.buildPortBindings(config.ports),
        Binds: config.volumes?.map((v) => `${v.source}:${v.target}${v.readOnly ? ":ro" : ""}`),
        NetworkMode: primaryNetwork,
      },
      NetworkingConfig: endpointsConfig ? { EndpointsConfig: endpointsConfig } : undefined,
      Healthcheck: config.healthCheck
        ? {
            Test: config.healthCheck.test,
            Interval: this.parseTime(config.healthCheck.interval) || 30_000_000_000,
            Timeout: this.parseTime(config.healthCheck.timeout) || 30_000_000_000,
            Retries: config.healthCheck.retries || 3,
            StartPeriod: this.parseTime(config.healthCheck.startPeriod) || 0,
          }
        : undefined,
    };

    const container = await this.docker.createContainer(createOptions);
    const info = await container.inspect();

    return this.mapContainerInfo(info);
  }

  async start(id: string): Promise<void> {
    const container = this.docker.getContainer(id);
    await container.start();
  }

  async stop(id: string, options?: StopOptions): Promise<void> {
    const container = this.docker.getContainer(id);
    await container.stop({ t: options?.timeout });
  }

  async restart(id: string): Promise<void> {
    const container = this.docker.getContainer(id);
    await container.restart();
  }

  async remove(id: string, options?: RemoveOptions): Promise<void> {
    const container = this.docker.getContainer(id);
    await container.remove({
      force: options?.force,
      v: options?.volumes,
    });
  }

  async rename(id: string, newName: string): Promise<void> {
    const container = this.docker.getContainer(id);
    await container.rename({ name: newName });
  }

  async inspect(id: string): Promise<ContainerInfo> {
    const container = this.docker.getContainer(id);
    const info = await container.inspect();
    return this.mapContainerInfoDetailed(info);
  }

  async list(filters?: ContainerFilters): Promise<Container[]> {
    const dockerFilters: Record<string, string[]> = {};

    if (filters?.id) dockerFilters.id = filters.id;
    if (filters?.name) dockerFilters.name = filters.name;
    if (filters?.status) dockerFilters.status = filters.status;
    if (filters?.label) {
      dockerFilters.label = Object.entries(filters.label).map(([k, v]) => `${k}=${v}`);
    }

    const containers = await this.docker.listContainers({
      all: true,
      filters: JSON.stringify(dockerFilters),
    });

    return containers.map((c) => ({
      id: c.Id,
      name: c.Names[0]?.replace(/^\//, "") || "",
      image: c.Image,
      status: this.mapStatus(c.State),
      state: {
        status: this.mapStatus(c.State),
        running: c.State === "running",
        paused: c.State === "paused",
        restarting: c.State === "restarting",
        oomKilled: false,
        dead: c.State === "dead",
        pid: 0,
        exitCode: undefined,
      },
      created: new Date(c.Created * 1000),
      labels: c.Labels,
    }));
  }

  async exec(id: string, command: string[], options?: ExecOptions): Promise<ExecResult> {
    const container = this.docker.getContainer(id);

    const exec = await container.exec({
      Cmd: command,
      AttachStdout: options?.attachStdout ?? true,
      AttachStderr: options?.attachStderr ?? true,
      AttachStdin: options?.attachStdin ?? false,
      Tty: options?.tty ?? false,
      Env: options?.env,
      WorkingDir: options?.workingDir,
      User: options?.user,
    });

    const stream = await exec.start({
      Tty: options?.tty ?? false,
      stdin: options?.attachStdin ?? false,
    });

    let output = "";
    let error = "";

    return new Promise((resolve, reject) => {
      if (options?.tty) {
        stream.on("data", (chunk: Buffer) => {
          output += chunk.toString();
        });
      } else {
        const stdoutStream = new Writable({
          write(chunk: Buffer | string, _encoding, callback): void {
            output += typeof chunk === "string" ? chunk : chunk.toString();
            callback();
          },
        });

        const stderrStream = new Writable({
          write(chunk: Buffer | string, _encoding, callback): void {
            error += typeof chunk === "string" ? chunk : chunk.toString();
            callback();
          },
        });

        this.docker.modem.demuxStream(stream, stdoutStream, stderrStream);
      }

      stream.on("end", () => {
        exec
          .inspect()
          .then((inspectData) => {
            resolve({
              exitCode: inspectData.ExitCode || 0,
              output: output.trim(),
              error: error.trim() || undefined,
            });
          })
          .catch(reject);
      });

      stream.on("error", reject);
    });
  }

  async execStream(
    id: string,
    command: string[],
    options?: ExecOptions
  ): Promise<ExecStreamResult> {
    const container = this.docker.getContainer(id);

    const exec = await container.exec({
      Cmd: command,
      AttachStdout: options?.attachStdout ?? true,
      AttachStderr: options?.attachStderr ?? true,
      AttachStdin: false,
      Tty: false,
      Env: options?.env,
      WorkingDir: options?.workingDir,
      User: options?.user,
    });

    const stream = await exec.start({ Tty: false, stdin: false });

    const stdout = new PassThrough();
    const stderr = new PassThrough();
    this.docker.modem.demuxStream(stream, stdout, stderr);

    let exitResolve: (value: { exitCode: number }) => void;
    let exitReject: (reason: unknown) => void;
    const wait = new Promise<{ exitCode: number }>((resolve, reject) => {
      exitResolve = resolve;
      exitReject = reject;
    });

    stream.on("end", () => {
      exec
        .inspect()
        .then((inspectData) => {
          exitResolve({ exitCode: inspectData.ExitCode ?? 0 });
        })
        .catch(exitReject);
    });

    stream.on("error", (err: Error) => {
      exitReject(err);
    });

    return { stdout, stderr, wait };
  }

  async interactiveExec(
    containerId: string,
    options?: InteractiveExecOptions
  ): Promise<InteractiveExecSession> {
    const container = this.docker.getContainer(containerId);
    const shell = options?.shell ?? "/bin/bash";
    const rows = options?.rows ?? 24;
    const cols = options?.cols ?? 80;

    const envEntries: string[] = [`TERM=xterm-256color`, `COLUMNS=${cols}`, `LINES=${rows}`];

    if (options?.env) {
      for (const [key, value] of Object.entries(options.env)) {
        envEntries.push(`${key}=${value}`);
      }
    }

    const exec = await container.exec({
      Cmd: options?.command ?? [shell],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Env: envEntries,
      WorkingDir: options?.workingDir,
      User: options?.user,
    });

    const stream = await exec.start({
      Tty: true,
      stdin: true,
      hijack: true,
    });

    // When TTY + hijack are enabled, stream is a raw Duplex —
    // stdout and stderr are merged into a single stream, no demuxing needed.
    const sessionId = exec.id;

    let exitResolve: (value: { exitCode: number }) => void;
    let exitReject: (reason: unknown) => void;
    const onExit = new Promise<{ exitCode: number }>((resolve, reject) => {
      exitResolve = resolve;
      exitReject = reject;
    });

    stream.on("end", () => {
      exec
        .inspect()
        .then((inspectData) => {
          exitResolve({ exitCode: inspectData.ExitCode ?? 0 });
        })
        .catch((err: unknown) => {
          exitReject(err);
        });
    });

    stream.on("error", (err: Error) => {
      exitReject(err);
    });

    return {
      id: sessionId,
      write(data: Buffer): void {
        if (!stream.destroyed) {
          stream.write(data);
        }
      },
      async resize(newRows: number, newCols: number): Promise<void> {
        await exec.resize({ h: newRows, w: newCols });
      },
      output: stream,
      async kill(): Promise<void> {
        try {
          const inspectData = await exec.inspect();
          if (inspectData.Running) {
            await new Promise<void>((resolve, reject) => {
              (
                container.modem as {
                  delete: (path: string, cb: (err: Error | null) => void) => void;
                }
              ).delete(`/exec/${sessionId}`, (err: Error | null) => {
                if (err) reject(err);
                else resolve();
              });
            });
          }
        } catch {
          // Exec may have already exited or API call failed.
        }
        // Always destroy the local stream to ensure cleanup
        try {
          if (!stream.destroyed) {
            stream.destroy();
          }
        } catch {
          // Stream destroy is idempotent, but edge cases be wildin'
        }
      },
      onExit,
    };
  }

  async *logs(id: string, options?: LogOptions): AsyncIterableIterator<LogEntry> {
    const container = this.docker.getContainer(id);

    const tailValue = options?.tail === "all" ? "all" : options?.tail;
    const shouldFollow = options?.follow ?? false;

    if (shouldFollow) {
      const followOptions: Docker.ContainerLogsOptions & { follow: true } = {
        stdout: options?.stdout ?? true,
        stderr: options?.stderr ?? true,
        since: options?.since ? Math.floor(new Date(options.since).getTime() / 1000) : undefined,
        until: options?.until ? Math.floor(new Date(options.until).getTime() / 1000) : undefined,
        timestamps: options?.timestamps ?? true,
        tail: tailValue as Docker.ContainerLogsOptions["tail"],
        follow: true,
      };

      const logStream = await container.logs(followOptions);
      const stream = logStream as unknown as NodeJS.ReadableStream;
      let buffer = Buffer.alloc(0);

      try {
        for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk as Buffer]);

          const headerSize = 8;
          let offset = 0;
          while (offset + headerSize <= buffer.length) {
            const streamType = buffer[offset];
            const payloadLength = buffer.readUInt32BE(offset + 4);
            const payloadStart = offset + 8;
            const payloadEnd = payloadStart + payloadLength;

            if (payloadEnd > buffer.length) {
              break;
            }

            const payload = buffer.subarray(payloadStart, payloadEnd);
            const message = payload.toString("utf-8");

            const lines = message.split("\n").filter((line) => line.trim());
            for (const line of lines) {
              yield this.parseLogLine(
                line,
                followOptions?.timestamps,
                streamType === 1 ? "stdout" : "stderr"
              );
            }

            offset = payloadEnd;
          }

          buffer = buffer.subarray(offset);
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("stream ended")) {
          return;
        }
        throw error;
      }
    } else {
      const nonFollowOptions: Docker.ContainerLogsOptions & { follow?: false } = {
        stdout: options?.stdout ?? true,
        stderr: options?.stderr ?? true,
        since: options?.since ? Math.floor(new Date(options.since).getTime() / 1000) : undefined,
        until: options?.until ? Math.floor(new Date(options.until).getTime() / 1000) : undefined,
        timestamps: options?.timestamps ?? true,
        tail: tailValue as Docker.ContainerLogsOptions["tail"],
        follow: false,
      };

      const logBuffer = await container.logs(nonFollowOptions);

      let offset = 0;
      while (offset < logBuffer.length) {
        // Docker log frame format: [stream_type(1)][3 padding bytes][payload_length(4)][payload(N)]
        const headerSize = 8;
        if (offset + headerSize > logBuffer.length) break;

        const streamType = logBuffer[offset];
        const payloadLength = logBuffer.readUInt32BE(offset + 4);
        const payloadStart = offset + 8;
        const payloadEnd = payloadStart + payloadLength;

        if (payloadEnd > logBuffer.length) break;

        const payload = logBuffer.subarray(payloadStart, payloadEnd);
        const message = payload.toString("utf-8");

        const lines = message.split("\n").filter((line) => line.trim());
        for (const line of lines) {
          yield this.parseLogLine(
            line,
            nonFollowOptions?.timestamps,
            streamType === 1 ? "stdout" : "stderr"
          );
        }

        offset = payloadEnd;
      }
    }
  }

  private parseLogLine(
    line: string,
    includeTimestamp: boolean | undefined,
    stream: "stdout" | "stderr"
  ): LogEntry {
    let timestamp = new Date();
    let actualMessage = line;

    if (includeTimestamp && line.match(/^\d{4}-\d{2}-\d{2}T/)) {
      const parts = line.split(" ");
      timestamp = new Date(parts[0]);
      actualMessage = parts.slice(1).join(" ");
    }

    return {
      timestamp,
      stream,
      message: actualMessage,
    };
  }

  async stats(id: string, stream: boolean = false): Promise<ContainerStats> {
    const container = this.docker.getContainer(id);

    if (stream) {
      const statsStream = await container.stats({ stream: true });
      return new Promise((resolve, reject) => {
        statsStream.once("data", (data: Buffer) => {
          try {
            resolve(this.mapStats(JSON.parse(data.toString()) as Docker.ContainerStats));
          } catch (err) {
            reject(err instanceof Error ? err : new Error("Failed to parse container stats"));
          }
        });
        statsStream.once("error", reject);
      });
    }

    const stats = await container.stats({ stream: false });
    return this.mapStats(stats);
  }

  async *events(filters?: EventFilters): AsyncIterableIterator<ContainerEvent> {
    const dockerFilters: Record<string, string[]> = {};

    if (filters?.type) dockerFilters.type = filters.type;
    if (filters?.event) dockerFilters.event = filters.event;
    if (filters?.label) dockerFilters.label = filters.label;
    if (filters?.container) dockerFilters.container = filters.container;

    const stream = await this.docker.getEvents({
      filters: JSON.stringify(dockerFilters),
    });

    for await (const chunk of stream) {
      const events = chunk
        .toString()
        .split("\n")
        .filter((line: string) => line.trim());

      for (const eventStr of events) {
        try {
          yield JSON.parse(eventStr) as ContainerEvent;
        } catch {
          // we don't need to bother with malformed events tbvh
        }
      }
    }
  }

  async createNetwork(config: NetworkConfig): Promise<Network> {
    const network = await this.docker.createNetwork({
      Name: config.name,
      Driver: config.driver || "bridge",
      Internal: config.internal,
      Attachable: config.attachable,
      Labels: config.labels,
      Options: config.options,
    });

    const info = await network.inspect();
    return this.mapNetworkInfo(info);
  }

  async removeNetwork(id: string): Promise<void> {
    const network = this.docker.getNetwork(id);
    await network.remove();
  }

  async listNetworks(filters?: NetworkFilters): Promise<Network[]> {
    const dockerFilters: Record<string, string[]> = {};

    if (filters?.name) dockerFilters.name = filters.name;
    if (filters?.id) dockerFilters.id = filters.id;
    if (filters?.label) {
      dockerFilters.label = Object.entries(filters.label).map(([k, v]) => `${k}=${v}`);
    }

    const networks = await this.docker.listNetworks({
      filters: JSON.stringify(dockerFilters),
    });

    return networks.map((n) => this.mapNetworkInfo(n));
  }

  async connectNetwork(
    containerId: string,
    networkId: string,
    config?: NetworkConnectConfig
  ): Promise<void> {
    const network = this.docker.getNetwork(networkId);

    await network.connect({
      Container: containerId,
      EndpointConfig: config
        ? {
            Aliases: config.aliases,
            IPAddress: config.ipAddress,
            Links: config.links,
          }
        : undefined,
    });
  }

  async disconnectNetwork(
    containerId: string,
    networkId: string,
    force: boolean = false
  ): Promise<void> {
    const network = this.docker.getNetwork(networkId);

    await network.disconnect({
      Container: containerId,
      Force: force,
    });
  }

  async createVolume(config: VolumeConfig): Promise<Volume> {
    await this.docker.createVolume({
      Name: config.name,
      Driver: config.driver,
      Labels: config.labels,
      DriverOpts: config.options,
    });

    const volume = this.docker.getVolume(config.name);
    const info = await volume.inspect();
    return this.mapVolumeInfo(info);
  }

  async removeVolume(name: string): Promise<void> {
    const volume = this.docker.getVolume(name);
    await volume.remove();
  }

  async listVolumes(filters?: VolumeFilters): Promise<Volume[]> {
    const dockerFilters: Record<string, string[]> = {};

    if (filters?.name) dockerFilters.name = filters.name;
    if (filters?.label) {
      dockerFilters.label = Object.entries(filters.label).map(([k, v]) => `${k}=${v}`);
    }

    const result = await this.docker.listVolumes({
      filters: JSON.stringify(dockerFilters),
    });

    return (result.Volumes || []).map((v) => this.mapVolumeInfo(v));
  }

  async pullImage(name: string, options?: PullOptions): Promise<void> {
    const tag = options?.tag || "latest";
    const imageName = `${name}:${tag}`;

    return new Promise((resolve, reject) => {
      this.docker.pull(imageName, { authconfig: options?.authconfig }, (err, stream) => {
        if (err) {
          reject(err instanceof Error ? err : new Error("Failed to pull image"));
          return;
        }

        if (!stream) {
          reject(new Error("Failed to get pull stream from Docker"));
          return;
        }

        this.docker.modem.followProgress(
          stream,
          (err: Error | null) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          },
          (event: PullProgress) => {
            if (options?.onProgress) {
              options.onProgress(event);
            }
          }
        );
      });
    });
  }

  async buildImage(context: string, options?: BuildOptions): Promise<BuildResult> {
    const tar = (await import("tar-fs")) as typeof import("tar-fs");

    // Try to use .dockerignore if it exists, otherwise fall back to default patterns
    const ignoreFilter = DockerIgnoreFilter.fromFile(context);
    const ignoreFn = ignoreFilter ? ignoreFilter.toTarIgnore() : createDefaultIgnore();

    const tarStream = tar.pack(context, {
      ignore: ignoreFn,
    });

    const dockerOptions: Docker.ImageBuildOptions = {
      dockerfile: options?.dockerfile ?? "Dockerfile",
      // TODO: Get back to this
      t: options?.tags?.[0] ?? "",
      labels: options?.labels,
      buildargs: options?.buildArgs,
      target: options?.target,
      platform: options?.platform,
      pull: options?.pull,
      nocache: options?.noCache,
    };

    const buildStream = await this.docker.buildImage(tarStream, dockerOptions);

    const warnings: string[] = [];
    let imageId = "";

    return new Promise<BuildResult>((resolve, reject) => {
      const handleLine = (line: BuildProgress): void => {
        if (options?.onProgress) {
          options.onProgress(line);
        }

        if (line.stream?.toLowerCase().includes("warning")) {
          warnings.push(line.stream);
        }

        if (line.aux?.ID) {
          imageId = line.aux.ID;
        }

        if (line.error || line.errorDetail) {
          const message = line.errorDetail?.message ?? line.error ?? "Build failed";

          if (
            message.includes("Dockerfile parse error") ||
            message.includes("unknown instruction")
          ) {
            reject(new DockerSyntaxError(message));
          } else {
            reject(new BuildError("build", message));
          }
        }
      };

      let buffer = "";

      buildStream.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const parsed = JSON.parse(line) as BuildProgress;
            handleLine(parsed);
          } catch {
            // TODO: Log
          }
        }
      });

      buildStream.on("end", () => {
        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer) as BuildProgress;
            handleLine(parsed);
          } catch {
            // TODO: Log
          }
        }

        if (!imageId) {
          reject(new BuildError("build", "No image ID returned from Docker"));
          return;
        }

        this.docker
          .getImage(imageId)
          .inspect()
          .then((imageInfo) => {
            resolve({
              imageId,
              sizeBytes: imageInfo.Size,
              layers: imageInfo.RootFS.Layers ?? [],
              warnings,
            });
          })
          .catch((err) => {
            reject(new BuildError("inspect", err instanceof Error ? err.message : String(err)));
          });
      });

      buildStream.on("error", (err: Error) => {
        reject(new BuildError("stream", err.message));
      });
    });
  }

  async removeImage(id: string, options?: RemoveImageOptions): Promise<void> {
    const image = this.docker.getImage(id);
    await image.remove({
      force: options?.force,
      noprune: options?.noPrune,
    });
  }

  async listImages(filters?: ImageFilters): Promise<Image[]> {
    const dockerFilters: Record<string, string[]> = {};

    if (filters?.reference) dockerFilters.reference = filters.reference;
    if (filters?.label) {
      dockerFilters.label = Object.entries(filters.label).map(([k, v]) => `${k}=${v}`);
    }
    if (filters?.dangling !== undefined) {
      dockerFilters.dangling = [filters.dangling ? "true" : "false"];
    }

    const images = await this.docker.listImages({
      filters: JSON.stringify(dockerFilters),
    });

    return images.map((img) => ({
      id: img.Id,
      repoTags: img.RepoTags || [],
      created: new Date(img.Created * 1000),
      size: img.Size,
      labels: img.Labels,
    }));
  }

  async pruneDanglingImages(): Promise<{
    deleted: string[];
    reclaimedBytes: number;
  }> {
    const result: PruneImagesInfo = await this.docker.pruneImages({
      filters: JSON.stringify({ dangling: { true: true } }),
    });

    return {
      deleted: (result.ImagesDeleted ?? ([] as ImageRemoveInfo[]))
        .map((img: ImageRemoveInfo) => img.Untagged || img.Deleted)
        .filter(Boolean),
      reclaimedBytes: result.SpaceReclaimed ?? 0,
    };
  }

  async pruneOldImages(
    tagPrefix: string,
    maxAgeDays: number
  ): Promise<{
    deleted: string[];
    reclaimedBytes: number;
    errors: string[];
  }> {
    const images = await this.listImages({ dangling: false });
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);

    const deleted: string[] = [];
    let reclaimedBytes = 0;
    const errors: string[] = [];

    for (const image of images) {
      const matchingTag = image.repoTags?.find((tag) => tag.startsWith(tagPrefix));
      if (!matchingTag) continue;

      if (image.created && image.created < cutoff) {
        try {
          const beforeSize = image.size;
          await this.removeImage(image.id, { force: true });
          deleted.push(image.id);
          reclaimedBytes += beforeSize;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${image.id}: ${msg}`);
        }
      }
    }

    return { deleted, reclaimedBytes, errors };
  }

  async getSystemInfo(): Promise<DockerSystemInfo> {
    const info = (await this.docker.info()) as DockerSystemInfo;
    return {
      ServerVersion: info.ServerVersion,
      OperatingSystem: info.OperatingSystem,
      KernelVersion: info.KernelVersion,
      Architecture: info.Architecture,
      NCPU: info.NCPU,
      MemTotal: info.MemTotal,
      Containers: info.Containers,
      ContainersRunning: info.ContainersRunning,
      ContainersPaused: info.ContainersPaused,
      ContainersStopped: info.ContainersStopped,
      Images: info.Images,
      Driver: info.Driver,
      Name: info.Name,
      Labels: info.Labels,
      Warnings: info.Warnings,
    };
  }

  async getAggregatedStats(): Promise<{
    cpuPercent: number;
    memoryUsedBytes: number;
    memoryLimitBytes: number;
  }> {
    const containers = await this.docker.listContainers({
      filters: JSON.stringify({ status: ["running"] }),
    });

    if (containers.length === 0) {
      const info = (await this.docker.info()) as DockerSystemInfo;
      return { cpuPercent: 0, memoryUsedBytes: 0, memoryLimitBytes: info.MemTotal };
    }

    const statsPromises = containers.map(
      (c) =>
        new Promise<{ cpuPercent: number; memoryUsedBytes: number; memoryLimitBytes: number }>(
          (resolve, reject) => {
            const container = this.docker.getContainer(c.Id);
            container.stats({ stream: false }, (err, data) => {
              if (err || !data) {
                const message =
                  err instanceof Error
                    ? err.message
                    : typeof err === "string"
                      ? err
                      : "No stats returned";
                reject(new Error(message));
                return;
              }

              const cpuDelta =
                data.cpu_stats.cpu_usage.total_usage - data.precpu_stats.cpu_usage.total_usage;
              const systemDelta =
                data.cpu_stats.system_cpu_usage - data.precpu_stats.system_cpu_usage;
              const cpuPercent =
                systemDelta > 0 ? (cpuDelta / systemDelta) * data.cpu_stats.online_cpus * 100 : 0;

              resolve({
                cpuPercent,
                memoryUsedBytes: data.memory_stats.usage || 0,
                memoryLimitBytes: data.memory_stats.limit || 1,
              });
            });
          }
        )
    );

    const results = await Promise.allSettled(statsPromises);
    const succeeded = results
      .filter(
        (
          r
        ): r is PromiseFulfilledResult<{
          cpuPercent: number;
          memoryUsedBytes: number;
          memoryLimitBytes: number;
        }> => r.status === "fulfilled"
      )
      .map((r) => r.value);

    if (succeeded.length === 0) {
      const info = (await this.docker.info()) as DockerSystemInfo;
      return { cpuPercent: 0, memoryUsedBytes: 0, memoryLimitBytes: info.MemTotal };
    }

    const totalCpuPercent = Math.min(
      succeeded.reduce((sum, s) => sum + s.cpuPercent, 0),
      100 * (succeeded[0]?.memoryLimitBytes ? 1 : 1)
    );

    const memoryLimitBytes = succeeded[0]?.memoryLimitBytes ?? 0;
    const totalMemoryUsed = succeeded.reduce((sum, s) => sum + s.memoryUsedBytes, 0);

    return {
      cpuPercent: Math.round(totalCpuPercent * 10) / 10,
      memoryUsedBytes: totalMemoryUsed,
      memoryLimitBytes,
    };
  }

  async getDiskUsage(): Promise<{
    imagesSizeBytes: number;
    containersSizeBytes: number;
    volumesSizeBytes: number;
    totalSizeBytes: number;
  }> {
    const df = (await this.docker.df()) as {
      LayersSize?: number;
      Images?: Array<{ Size?: number }>;
      Containers?: Array<{ SizeRw?: number }>;
      Volumes?: Array<{ UsageData?: { Size?: number } }>;
    };

    const imagesSizeBytes = df.LayersSize ?? 0;
    const containersSizeBytes = df.Containers?.reduce((sum, c) => sum + (c.SizeRw ?? 0), 0) ?? 0;
    const volumesSizeBytes = df.Volumes?.reduce((sum, v) => sum + (v.UsageData?.Size ?? 0), 0) ?? 0;
    const totalSizeBytes = imagesSizeBytes + containersSizeBytes + volumesSizeBytes;

    return { imagesSizeBytes, containersSizeBytes, volumesSizeBytes, totalSizeBytes };
  }

  async getImageDiskUsage(tagPrefix?: string): Promise<{
    count: number;
    totalBytes: number;
  }> {
    const images = await this.listImages({ dangling: false });

    const filtered = tagPrefix
      ? images.filter((img) => img.repoTags?.some((tag) => tag.startsWith(tagPrefix)))
      : images;

    const totalBytes = filtered.reduce((sum, img) => sum + (img.size || 0), 0);

    return {
      count: filtered.length,
      totalBytes,
    };
  }

  private buildExposedPorts(
    ports?: Array<{
      containerPort: number;
      protocol?: "tcp" | "udp";
    }>
  ): Docker.ContainerCreateOptions["ExposedPorts"] | undefined {
    if (!ports || ports.length === 0) return undefined;

    const exposed: Docker.ContainerCreateOptions["ExposedPorts"] = {};
    for (const port of ports) {
      const key = `${port.containerPort}/${port.protocol || "tcp"}`;
      exposed[key] = {};
    }

    return exposed;
  }

  private buildPortBindings(
    ports?: Array<{
      containerPort: number;
      hostPort?: number;
      protocol?: "tcp" | "udp";
      hostIp?: string;
    }>
  ): Docker.PortMap | undefined {
    if (!ports || ports.length === 0) return undefined;

    const bindings: Docker.PortMap = {};

    for (const port of ports) {
      const key = `${port.containerPort}/${port.protocol || "tcp"}`;
      bindings[key] = [
        {
          HostPort: port.hostPort?.toString() || "",
          HostIp: port.hostIp || "0.0.0.0",
        },
      ];
    }

    return bindings;
  }

  private parseMemory(memory: string): number {
    const match = memory.match(/^(\d+(?:\.\d+)?)(b|k|m|g)?$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = (match[2] || "b").toLowerCase();

    const multipliers: Record<string, number> = {
      b: 1,
      k: 1024,
      m: 1024 * 1024,
      g: 1024 * 1024 * 1024,
    };

    return value * multipliers[unit];
  }

  private parseTime(time?: string): number | undefined {
    if (!time) return undefined;

    const match = time.match(/^(\d+)(s|m|h)?$/);
    if (!match) return undefined;

    const value = parseInt(match[1], 10);
    const unit = match[2] || "s";

    const multipliers: Record<string, number> = {
      s: 1_000_000_000,
      m: 60_000_000_000,
      h: 3600_000_000_000,
    };

    return value * multipliers[unit];
  }

  private mapStatus(state: string): Container["status"] {
    const statusMap: Record<string, Container["status"]> = {
      created: "created",
      running: "running",
      paused: "paused",
      restarting: "restarting",
      removing: "removing",
      exited: "exited",
      dead: "dead",
    };

    return statusMap[state] || "exited";
  }

  private mapContainerInfo(info: Docker.ContainerInspectInfo): Container {
    return {
      id: info.Id,
      name: info.Name.replace(/^\//, ""),
      image: info.Config.Image,
      status: this.mapStatus(info.State.Status),
      state: {
        status: this.mapStatus(info.State.Status),
        running: info.State.Running,
        paused: info.State.Paused,
        restarting: info.State.Restarting,
        oomKilled: info.State.OOMKilled,
        dead: info.State.Dead,
        pid: info.State.Pid,
        exitCode: info.State.ExitCode,
        startedAt: info.State.StartedAt ? new Date(info.State.StartedAt) : undefined,
        finishedAt: info.State.FinishedAt ? new Date(info.State.FinishedAt) : undefined,
      },
      created: new Date(info.Created),
      labels: info.Config.Labels,
    };
  }

  private mapContainerInfoDetailed(info: Docker.ContainerInspectInfo): ContainerInfo {
    const portBindings: Record<string, { hostIp: string; hostPort: string }[]> = {};

    if (info.NetworkSettings.Ports) {
      for (const [containerPort, bindings] of Object.entries(info.NetworkSettings.Ports)) {
        if (bindings) {
          portBindings[containerPort] = bindings.map((b) => ({
            hostIp: b.HostIp,
            hostPort: b.HostPort,
          }));
        }
      }
    }

    const networks: Record<string, NetworkEndpoint> = {};
    if (info.NetworkSettings.Networks) {
      for (const [name, network] of Object.entries(info.NetworkSettings.Networks)) {
        networks[name] = {
          ipAddress: network.IPAddress,
          gateway: network.Gateway,
          networkId: network.NetworkID,
          endpointId: network.EndpointID,
          macAddress: network.MacAddress,
        };
      }
    }

    return {
      id: info.Id,
      name: info.Name.replace(/^\//, ""),
      image: info.Config.Image,
      status: this.mapStatus(info.State.Status),
      state: {
        status: this.mapStatus(info.State.Status),
        running: info.State.Running,
        paused: info.State.Paused,
        restarting: info.State.Restarting,
        oomKilled: info.State.OOMKilled,
        dead: info.State.Dead,
        pid: info.State.Pid,
        exitCode: info.State.ExitCode,
        error: info.State.Error || undefined,
        startedAt: info.State.StartedAt ? new Date(info.State.StartedAt) : undefined,
        finishedAt: info.State.FinishedAt ? new Date(info.State.FinishedAt) : undefined,
      },
      created: new Date(info.Created),
      config: {
        hostname: info.Config.Hostname,
        env: info.Config.Env || [],
        cmd: info.Config.Cmd || undefined,
        labels: info.Config.Labels || {},
        workingDir: info.Config.WorkingDir || undefined,
      },
      networkSettings: {
        ipAddress: info.NetworkSettings.IPAddress,
        gateway: info.NetworkSettings.Gateway || undefined,
        ports: portBindings,
        networks,
      },
      mounts: (info.Mounts || []).map((m) => ({
        type: m.Type as "bind" | "volume",
        source: m.Source,
        destination: m.Destination,
        mode: m.Mode,
        rw: m.RW,
      })),
      health: info.State.Health
        ? {
            status: info.State.Health.Status as ContainerHealthStatus,
            failingStreak: info.State.Health.FailingStreak,
            log: info.State.Health.Log?.map((l) => ({
              start: new Date(l.Start),
              end: l.End ? new Date(l.End) : undefined,
              exitCode: l.ExitCode,
              output: l.Output,
            })),
          }
        : undefined,
    };
  }

  private mapStats(stats: Docker.ContainerStats): ContainerStats {
    const cpuDelta =
      stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuPercent =
      systemDelta > 0 ? (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100 : 0;

    const memoryUsage = stats.memory_stats.usage || 0;
    const memoryLimit = stats.memory_stats.limit || 1;
    const memoryPercent = (memoryUsage / memoryLimit) * 100;

    return {
      timestamp: new Date(),
      cpu: {
        usage: cpuPercent,
        systemUsage: stats.cpu_stats.system_cpu_usage,
        onlineCpus: stats.cpu_stats.online_cpus,
      },
      memory: {
        usage: memoryUsage,
        limit: memoryLimit,
        percentage: memoryPercent,
      },
      network: {
        rxBytes: Object.values(stats.networks || {}).reduce(
          (acc: number, net: Docker.NetworkStats[number]) => acc + (net.rx_bytes || 0),
          0
        ),
        txBytes: Object.values(stats.networks || {}).reduce(
          (acc: number, net: Docker.NetworkStats[number]) => acc + (net.tx_bytes || 0),
          0
        ),
        rxPackets: Object.values(stats.networks || {}).reduce(
          (acc: number, net: Docker.NetworkStats[number]) => acc + (net.rx_packets || 0),
          0
        ),
        txPackets: Object.values(stats.networks || {}).reduce(
          (acc: number, net: Docker.NetworkStats[number]) => acc + (net.tx_packets || 0),
          0
        ),
      },
      blockIO: {
        readBytes:
          stats.blkio_stats?.io_service_bytes_recursive?.find(
            (item: Docker.BlkioStatEntry) => item.op === "read"
          )?.value || 0,
        writeBytes:
          stats.blkio_stats?.io_service_bytes_recursive?.find(
            (item: Docker.BlkioStatEntry) => item.op === "write"
          )?.value || 0,
      },
    };
  }

  private mapNetworkInfo(info: Docker.NetworkInspectInfo): Network {
    return {
      id: info.Id,
      name: info.Name,
      driver: info.Driver,
      scope: info.Scope,
      internal: info.Internal,
      attachable: info.Attachable,
      created: new Date(info.Created),
      labels: info.Labels,
    };
  }

  private mapVolumeInfo(info: Docker.VolumeInspectInfo): Volume {
    const volumeInfo: Volume = {
      name: info.Name,
      driver: info.Driver,
      mountpoint: info.Mountpoint,
      labels: info.Labels,
    };

    // CreatedAt is not in dockerode types but may be present in the actual API response
    if (info && typeof info === "object" && "CreatedAt" in info) {
      const createdAt = (info as unknown as { CreatedAt: string }).CreatedAt;
      if (createdAt) {
        volumeInfo.created = new Date(createdAt);
      }
    }

    return volumeInfo;
  }
}
