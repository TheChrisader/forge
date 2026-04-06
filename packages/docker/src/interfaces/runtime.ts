export interface IContainerRuntime {
  create(config: ContainerConfig): Promise<Container>;
  start(id: string): Promise<void>;
  stop(id: string, options?: StopOptions): Promise<void>;
  restart(id: string): Promise<void>;
  remove(id: string, options?: RemoveOptions): Promise<void>;

  inspect(id: string): Promise<ContainerInfo>;
  list(filters?: ContainerFilters): Promise<Container[]>;

  exec(id: string, command: string[], options?: ExecOptions): Promise<ExecResult>;

  interactiveExec(
    containerId: string,
    options?: InteractiveExecOptions
  ): Promise<InteractiveExecSession>;

  logs(id: string, options?: LogOptions): AsyncIterableIterator<LogEntry>;

  stats(id: string, stream?: boolean): Promise<ContainerStats>;

  events(filters?: EventFilters): AsyncIterableIterator<ContainerEvent>;

  healthCheck(): Promise<HealthCheckResult>;

  waitForHealthy(id: string, options?: WaitOptions): Promise<void>;
  waitForState(id: string, state: ContainerStatus, options?: WaitOptions): Promise<void>;

  createNetwork(config: NetworkConfig): Promise<Network>;
  removeNetwork(id: string): Promise<void>;
  listNetworks(filters?: NetworkFilters): Promise<Network[]>;

  connectNetwork(
    containerId: string,
    networkId: string,
    config?: NetworkConnectConfig
  ): Promise<void>;
  disconnectNetwork(containerId: string, networkId: string, force?: boolean): Promise<void>;

  createVolume(config: VolumeConfig): Promise<Volume>;
  removeVolume(name: string): Promise<void>;
  listVolumes(filters?: VolumeFilters): Promise<Volume[]>;

  pullImage(name: string, options?: PullOptions): Promise<void>;
  buildImage(context: string, options?: BuildOptions): Promise<BuildResult>;
  removeImage(id: string, options?: RemoveImageOptions): Promise<void>;
  listImages(filters?: ImageFilters): Promise<Image[]>;
  pruneDanglingImages(): Promise<{
    deleted: string[];
    reclaimedBytes: number;
  }>;
  pruneOldImages(
    tagPrefix: string,
    maxAgeDays: number
  ): Promise<{
    deleted: string[];
    reclaimedBytes: number;
    errors: string[];
  }>;
  getImageDiskUsage(tagPrefix?: string): Promise<{
    count: number;
    totalBytes: number;
  }>;
}

export interface NetworkAttachment {
  name: string;
  aliases?: string[];
}

export interface ContainerConfig {
  name?: string;
  image: string;
  cmd?: string[];
  entrypoint?: string[];
  env?: Record<string, string>;
  labels?: Record<string, string>;
  ports?: PortMapping[];
  volumes?: VolumeMount[];
  readOnly?: boolean;
  /** @deprecated Use `networks` instead */
  network?: string;
  /** @deprecated Use `networks[0].aliases` instead */
  networkAliases?: string[];
  /** Attach container to multiple networks. When provided, takes precedence over the legacy `network` field. */
  networks?: NetworkAttachment[];
  workingDir?: string;
  capabilities?: {
    add?: string[];
    drop?: string[];
  };
  user?: string;
  resources?: ResourceLimits;
  healthCheck?: HealthCheckConfig;
  restartPolicy?: RestartPolicy;
  autoRemove?: boolean;
}

export interface PortMapping {
  containerPort: number;
  hostPort?: number;
  protocol?: "tcp" | "udp";
  hostIp?: string;
}

export interface VolumeMount {
  source: string;
  target: string;
  readOnly?: boolean;
}

export interface ResourceLimits {
  memory?: string;
  memorySwap?: string;
  cpus?: number;
  cpuShares?: number;
}

export interface HealthCheckConfig {
  test: string[];
  interval?: string;
  timeout?: string;
  retries?: number;
  startPeriod?: string;
}

export interface RestartPolicy {
  name: "no" | "always" | "on-failure" | "unless-stopped";
  maximumRetryCount?: number;
}

export interface Container {
  id: string;
  name: string;
  image: string;
  status: ContainerStatus;
  state: ContainerState;
  created: Date;
  labels?: Record<string, string>;
}

export type ContainerStatus =
  | "created"
  | "running"
  | "paused"
  | "restarting"
  | "removing"
  | "exited"
  | "dead";

export interface ContainerState {
  status: ContainerStatus;
  running: boolean;
  paused: boolean;
  restarting: boolean;
  oomKilled: boolean;
  dead: boolean;
  pid: number;
  exitCode?: number;
  error?: string;
  startedAt?: Date;
  finishedAt?: Date;
}

export type ContainerHealthStatus = "healthy" | "unhealthy" | "starting" | "none";

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: ContainerStatus;
  state: ContainerState;
  created: Date;
  config: {
    hostname: string;
    env: string[];
    cmd?: string[];
    labels: Record<string, string>;
    workingDir?: string;
  };
  networkSettings: {
    ipAddress: string;
    gateway?: string;
    ports: Record<string, { hostIp: string; hostPort: string }[]>;
    networks: Record<string, NetworkEndpoint>;
  };
  mounts: Array<{
    type: "bind" | "volume";
    source: string;
    destination: string;
    mode: string;
    rw: boolean;
  }>;
  health?: {
    status: ContainerHealthStatus;
    failingStreak: number;
    log?: Array<{
      start: Date;
      end?: Date;
      exitCode: number;
      output: string;
    }>;
  };
}

export interface NetworkEndpoint {
  ipAddress: string;
  gateway: string;
  networkId: string;
  endpointId: string;
  macAddress: string;
}

export interface StopOptions {
  timeout?: number;
}

export interface RemoveOptions {
  force?: boolean;
  volumes?: boolean;
}

export interface ExecOptions {
  tty?: boolean;
  attachStdin?: boolean;
  attachStdout?: boolean;
  attachStderr?: boolean;
  env?: string[];
  workingDir?: string;
  user?: string;
}

export interface ExecResult {
  exitCode: number;
  output: string;
  error?: string;
}

export interface LogOptions {
  follow?: boolean;
  stdout?: boolean;
  stderr?: boolean;
  since?: Date | number;
  until?: Date | number;
  timestamps?: boolean;
  tail?: number | "all";
}

export interface LogEntry {
  timestamp: Date;
  stream: "stdout" | "stderr";
  message: string;
}

export interface ContainerStats {
  timestamp: Date;
  cpu: {
    usage: number;
    systemUsage: number;
    onlineCpus: number;
  };
  memory: {
    usage: number;
    limit: number;
    percentage: number;
  };
  network: {
    rxBytes: number;
    txBytes: number;
    rxPackets: number;
    txPackets: number;
  };
  blockIO: {
    readBytes: number;
    writeBytes: number;
  };
}

export interface ContainerEvent {
  Type:
    | "container"
    | "image"
    | "network"
    | "volume"
    | "daemon"
    | "plugin"
    | "node"
    | "secret"
    | "service"
    | "config";
  Action: string;
  Actor: {
    ID: string;
    Attributes: Record<string, string>;
  };
  scope?: "local" | "swarm";
  time: number;
  timeNano?: number;
}

export interface EventFilters {
  type?: string[];
  event?: string[];
  label?: string[];
  container?: string[];
}

export interface ContainerFilters {
  id?: string[];
  name?: string[];
  label?: Record<string, string>;
  status?: ContainerStatus[];
}

export interface NetworkFilters {
  name?: string[];
  id?: string[];
  label?: Record<string, string>;
}

export interface VolumeFilters {
  name?: string[];
  label?: Record<string, string>;
}

export interface ImageFilters {
  reference?: string[];
  label?: Record<string, string>;
  dangling?: boolean;
}

export interface NetworkConfig {
  name: string;
  driver?: "bridge" | "host" | "overlay" | "macvlan" | "none";
  internal?: boolean;
  attachable?: boolean;
  labels?: Record<string, string>;
  options?: Record<string, string>;
}

export interface NetworkConnectConfig {
  aliases?: string[];
  ipAddress?: string;
  links?: string[];
}

export interface Network {
  id: string;
  name: string;
  driver: string;
  scope: string;
  internal: boolean;
  attachable: boolean;
  created: Date;
  labels?: Record<string, string>;
}

export interface VolumeConfig {
  name: string;
  driver?: string;
  labels?: Record<string, string>;
  options?: Record<string, string>;
}

export interface Volume {
  name: string;
  driver: string;
  mountpoint: string;
  created?: Date;
  labels?: Record<string, string>;
}

export interface PullOptions {
  tag?: string;
  authconfig?: {
    username: string;
    password: string;
    serveraddress?: string;
  };
  onProgress?: (progress: PullProgress) => void;
}

export interface PullProgress {
  status: string;
  id?: string;
  progress?: string;
  progressDetail?: {
    current: number;
    total: number;
  };
}

export interface BuildOptions {
  dockerfile?: string;
  tags?: string[];
  labels?: Record<string, string>;
  buildArgs?: Record<string, string>;
  target?: string;
  noCache?: boolean;
  pull?: boolean;
  platform?: string;
  onProgress?: (progress: BuildProgress) => void;
}

export interface BuildProgress {
  stream?: string;
  status?: string;
  progress?: string;
  error?: string;
  errorDetail?: {
    message: string;
  };
  aux?: {
    ID: string;
  };
}

export interface BuildResult {
  imageId: string;
  sizeBytes: number;
  layers: string[];
  warnings: string[];
}

export interface RemoveImageOptions {
  force?: boolean;
  noPrune?: boolean;
}

export interface Image {
  id: string;
  repoTags: string[];
  created: Date;
  size: number;
  labels?: Record<string, string>;
}

export interface DockerConnectionOptions {
  /**
   * Docker daemon connection method.
   * - "socket": Unix socket (Linux/Mac) or named pipe (Windows)
   * - "http": Remote HTTP connection
   */
  mode?: "socket" | "http";
  socketPath?: string;
  host?: string;
  port?: number;
  protocol?: "http" | "https";
  certPath?: string;
  ca?: string;
  key?: string;
  timeout?: number;
}

export interface HealthCheckResult {
  healthy: boolean;
  version?: string;
  apiVersion?: string;
  os?: string;
  error?: string;
}

export interface WaitOptions {
  timeout?: number;
  interval?: number;
  signal?: AbortSignal;
}

export interface InteractiveExecOptions {
  command?: string[];
  shell?: string;
  env?: Record<string, string>;
  workingDir?: string;
  user?: string;
  rows?: number;
  cols?: number;
}

export interface InteractiveExecSession {
  id: string;
  /** Write raw bytes (user keystrokes) into the exec stream */
  write(data: Buffer): void;
  /** Resize the TTY dimensions */
  resize(rows: number, cols: number): Promise<void>;
  /** Raw output stream from the exec process (stdout + stderr multiplexed via TTY) */
  output: NodeJS.ReadableStream;
  /** Close the exec session */
  kill(): Promise<void>;
  /** Resolves when the exec process exits */
  onExit: Promise<{ exitCode: number }>;
}

export interface DockerSystemInfo {
  ServerVersion: string;
  OperatingSystem: string;
  KernelVersion: string;
  Architecture: string;
  NCPU: number;
  MemTotal: number;
  Containers: number;
  ContainersRunning: number;
  ContainersPaused: number;
  ContainersStopped: number;
  Images: number;
  Driver: string;
  Name: string;
  Labels?: string[];
  Warnings?: string[];
}
