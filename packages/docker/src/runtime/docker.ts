import Docker from "dockerode";
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
  LogOptions,
  LogEntry,
  ContainerStats,
  ContainerEvent,
  EventFilters,
  Network,
  NetworkConfig,
  NetworkFilters,
  Volume,
  VolumeConfig,
  VolumeFilters,
  Image,
  ImageFilters,
  PullOptions,
  BuildOptions,
  RemoveImageOptions,
  DockerConnectionOptions,
  HealthCheckResult,
  WaitOptions,
} from "../interfaces/runtime";
import {
  DockerRuntimeError,
  ContainerNotRunningError,
  HealthCheckTimeoutError,
  DockerConnectionError,
} from "../errors";

// Platform detection for cross-platform Docker socket paths
const DEFAULT_SOCKET_PATHS = {
  win32: "//./pipe/docker_engine", // Windows named pipe
  darwin: "/var/run/docker.sock", // macOS Unix socket
  linux: "/var/run/docker.sock", // Linux Unix socket
} as const;

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
    // Merge user options with platform defaults
    this.connectionOptions = this.normalizeOptions(options);
    this.docker = this.createDockerClient(this.connectionOptions);
  }

  /**
   * Normalize connection options with platform-aware defaults
   */
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
        timeout: options?.timeout || 10000,
      };
    }

    // Socket mode (default)
    return {
      mode: "socket",
      socketPath: options?.socketPath || getDefaultSocketPath(),
      timeout: options?.timeout || 10000,
    };
  }

  /**
   * Create Dockerode client with normalized options
   */
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

      // Socket mode
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

  /**
   * Health check - verify Docker daemon is accessible
   */
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const info = await this.docker.info();
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

  /**
   * Wait for container to become healthy
   */
  async waitForHealthy(id: string, options?: WaitOptions): Promise<void> {
    const timeout = options?.timeout || 120000; // 2 minutes default
    const interval = options?.interval || 2000; // 2 seconds default
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

        // Container running but no health check - treat as healthy
        if (info.state.running && !info.health) {
          return;
        }
      } catch (error) {
        if (error instanceof DockerRuntimeError) {
          throw error;
        }
        // Continue waiting on transient errors
      }

      await this.sleep(interval);
    }

    throw new HealthCheckTimeoutError(id, timeout);
  }

  /**
   * Wait for container to reach specific state
   */
  async waitForState(id: string, state: ContainerStatus, options?: WaitOptions): Promise<void> {
    const timeout = options?.timeout || 60000; // 1 minute default
    const interval = options?.interval || 1000; // 1 second default
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

        // Check for terminal states
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

  /**
   * Sleep utility for wait patterns
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Container lifecycle
  async create(config: ContainerConfig): Promise<Container> {
    const createOptions: Docker.ContainerCreateOptions = {
      name: config.name,
      Image: config.image,
      Cmd: config.cmd,
      Entrypoint: config.entrypoint,
      Env: config.env ? Object.entries(config.env).map(([k, v]) => `${k}=${v}`) : undefined,
      Labels: config.labels,
      WorkingDir: config.workingDir,
      User: config.user,
      HostConfig: {
        AutoRemove: config.autoRemove,
        RestartPolicy: config.restartPolicy
          ? {
              Name: config.restartPolicy.name,
              MaximumRetryCount: config.restartPolicy.maximumRetryCount,
            }
          : undefined,
        Memory: config.resources?.memory ? this.parseMemory(config.resources.memory) : undefined,
        NanoCpus: config.resources?.cpus ? config.resources.cpus * 1e9 : undefined,
        CpuShares: config.resources?.cpuShares,
        PortBindings: this.buildPortBindings(config.ports),
        Binds: config.volumes?.map((v) => `${v.source}:${v.target}${v.readOnly ? ":ro" : ""}`),
        NetworkMode: config.network,
      },
      NetworkingConfig: config.network
        ? {
            EndpointsConfig: {
              [config.network]: {
                Aliases: config.networkAliases,
              },
            },
          }
        : undefined,
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
        this.docker.modem.demuxStream(
          stream,
          {
            write: (chunk: Buffer) => {
              output += chunk.toString();
            },
          } as any,
          {
            write: (chunk: Buffer) => {
              error += chunk.toString();
            },
          } as any
        );
      }

      stream.on("end", async () => {
        try {
          const inspectData = await exec.inspect();
          resolve({
            exitCode: inspectData.ExitCode || 0,
            output: output.trim(),
            error: error.trim() || undefined,
          });
        } catch (err) {
          reject(err);
        }
      });

      stream.on("error", reject);
    });
  }

  async *logs(id: string, options?: LogOptions): AsyncIterableIterator<LogEntry> {
    const container = this.docker.getContainer(id);

    const tailValue = options?.tail === "all" ? "all" : options?.tail;

    const logOptions: Docker.ContainerLogsOptions & { follow?: false } = {
      stdout: options?.stdout ?? true,
      stderr: options?.stderr ?? true,
      since: options?.since ? Math.floor(new Date(options.since).getTime() / 1000) : undefined,
      until: options?.until ? Math.floor(new Date(options.until).getTime() / 1000) : undefined,
      timestamps: options?.timestamps ?? true,
      tail: tailValue as any, // Type assertion for compatibility
      follow: false,
    };

    // When follow is false, container.logs returns a Buffer containing multiplexed data
    const logBuffer = await container.logs(logOptions);

    // The buffer contains multiplexed frames: [header 8 bytes][payload][header 8 bytes][payload]...
    // Header format: [1 byte stream type][3 bytes padding][4 bytes big-endian size]
    let offset = 0;
    while (offset < logBuffer.length) {
      // Ensure we have at least 8 bytes for the header
      if (offset + 8 > logBuffer.length) break;

      const streamType = logBuffer[offset];
      const payloadLength = logBuffer.readUInt32BE(offset + 4);
      const payloadStart = offset + 8;
      const payloadEnd = payloadStart + payloadLength;

      // Ensure we have the full payload
      if (payloadEnd > logBuffer.length) break;

      const payload = logBuffer.subarray(payloadStart, payloadEnd);
      const message = payload.toString("utf-8");

      // Split by lines and yield each non-empty line
      const lines = message.split("\n").filter((line) => line.trim());
      for (const line of lines) {
        yield this.parseLogLine(line, options?.timestamps, streamType === 1 ? "stdout" : "stderr");
      }

      offset = payloadEnd;
    }
  }

  private parseLogLine(line: string, includeTimestamp: boolean | undefined, stream: "stdout" | "stderr"): LogEntry {
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
      // For streaming, return a promise that resolves with first stats
      const statsStream = await container.stats({ stream: true });
      return new Promise((resolve, reject) => {
        statsStream.once("data", (data: Buffer) => {
          try {
            resolve(this.mapStats(JSON.parse(data.toString())));
          } catch (err) {
            reject(err);
          }
        });
        statsStream.once("error", reject);
      });
    }

    // Non-streaming: use one-shot option
    const stats = await container.stats({ stream: false });
    return this.mapStats(stats as any);
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

    for await (const chunk of stream as any) {
      const events = chunk
        .toString()
        .split("\n")
        .filter((line: string) => line.trim());

      for (const eventStr of events) {
        try {
          const event = JSON.parse(eventStr);
          yield {
            type: event.Type,
            action: event.Action,
            actor: {
              id: event.Actor.ID,
              attributes: event.Actor.Attributes || {},
            },
            time: new Date(event.time * 1000),
          };
        } catch {
          // Skip malformed events
        }
      }
    }
  }

  // Network operations
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

  // Volume operations
  async createVolume(config: VolumeConfig): Promise<Volume> {
    await this.docker.createVolume({
      Name: config.name,
      Driver: config.driver,
      Labels: config.labels,
      DriverOpts: config.options,
    });

    // createVolume returns VolumeCreateResponse, use the volume name to get info
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

  // Image operations
  async pullImage(name: string, options?: PullOptions): Promise<void> {
    const tag = options?.tag || "latest";
    const imageName = `${name}:${tag}`;

    return new Promise((resolve, reject) => {
      this.docker.pull(imageName, { authconfig: options?.authconfig }, (err, stream) => {
        if (err) {
          reject(err);
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
          (event: any) => {
            if (options?.onProgress) {
              options.onProgress(event);
            }
          }
        );
      });
    });
  }

  async buildImage(_context: string, options?: BuildOptions): Promise<string> {
    const tarStream = require("tar-stream");

    // Create tar stream from context
    const pack = tarStream.pack();

    // This is a simplified version - in production, you'd use a proper tar library
    // to recursively add files from the context directory

    return new Promise((resolve, reject) => {
      this.docker.buildImage(
        pack,
        {
          dockerfile: options?.dockerfile || "Dockerfile",
          t: options?.tags?.[0], // dockerode expects string for tag
          labels: options?.labels,
          buildargs: options?.buildArgs,
          target: options?.target,
          nocache: options?.noCache,
          pull: options?.pull,
        },
        (err, stream) => {
          if (err) {
            reject(err);
            return;
          }

          if (!stream) {
            reject(new Error("Failed to get build stream from Docker"));
            return;
          }

          let imageId = "";

          this.docker.modem.followProgress(
            stream,
            (err: Error | null) => {
              if (err) {
                reject(err);
              } else {
                resolve(imageId);
              }
            },
            (event: any) => {
              if (options?.onProgress) {
                options.onProgress(event);
              }
              if (event.stream && event.stream.includes("Successfully built")) {
                imageId = event.stream.split("Successfully built ")[1].trim();
              }
            }
          );
        }
      );
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

  // Helper methods
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

    const networks: Record<string, any> = {};
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
            status: info.State.Health.Status as any,
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

  private mapStats(stats: any): ContainerStats {
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
          (acc: number, net: any) => acc + (net.rx_bytes || 0),
          0
        ),
        txBytes: Object.values(stats.networks || {}).reduce(
          (acc: number, net: any) => acc + (net.tx_bytes || 0),
          0
        ),
        rxPackets: Object.values(stats.networks || {}).reduce(
          (acc: number, net: any) => acc + (net.rx_packets || 0),
          0
        ),
        txPackets: Object.values(stats.networks || {}).reduce(
          (acc: number, net: any) => acc + (net.tx_packets || 0),
          0
        ),
      },
      blockIO: {
        readBytes:
          stats.blkio_stats.io_service_bytes_recursive?.find((item: any) => item.op === "read")
            ?.value || 0,
        writeBytes:
          stats.blkio_stats.io_service_bytes_recursive?.find((item: any) => item.op === "write")
            ?.value || 0,
      },
    };
  }

  private mapNetworkInfo(info: any): Network {
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

  private mapVolumeInfo(info: any): Volume {
    return {
      name: info.Name,
      driver: info.Driver,
      mountpoint: info.Mountpoint,
      created: new Date(info.CreatedAt),
      labels: info.Labels,
    };
  }
}
