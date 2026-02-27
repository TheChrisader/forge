import { z } from "zod";

/**
 * Build-time configuration schema
 */
export const ProjectBuildConfigSchema = z.object({
  /** Path to Dockerfile (relative to project root) */
  dockerfile: z.string().optional(),
  /** Build context directory */
  context: z.string().optional(),
  /** Build arguments */
  buildArgs: z.record(z.string(), z.string()).optional(),
  /** Target stage for multi-stage builds */
  target: z.string().optional(),
  /** Build cache source */
  cacheFrom: z.array(z.string()).optional(),
  /** Whether to pull base image on each build */
  pull: z.boolean().optional(),
  /** Platform for cross-compilation (linux/amd64, linux/arm64) */
  platform: z.string().optional(),
  /** Command to build the application */
  buildCommand: z.string().optional(),
  /** Command to install dependencies */
  installCommand: z.string().optional(),
  /** Git branch to deploy */
  branch: z.string().optional(),
  /** Framework name (e.g., "nextjs", "react", "express") */
  framework: z.string().optional(),
  /** Whether to auto-detect package.json scripts */
  autoDiscoverScripts: z.boolean().optional(),
});

/**
 * Runtime configuration schema (process execution)
 */
export const ProjectRuntimeConfigSchema = z.object({
  /** Main container port */
  port: z.number().int().positive().optional(),
  /** Environment variables */
  env: z.record(z.string(), z.string()).optional(),
  /** Command to run (overrides image CMD) */
  command: z.union([z.string(), z.array(z.string())]).optional(),
  /** Command to start the application */
  startCommand: z.string().optional(),
  /** Entrypoint override */
  entrypoint: z.array(z.string()).optional(),
  /** Working directory inside container */
  workingDir: z.string().optional(),
  /** User to run as (uid or username) */
  user: z.string().optional(),
  /** Node.js version to use */
  nodeVersion: z.string().optional(),
  /** Python version to use */
  pythonVersion: z.string().optional(),
  /** Go version to use */
  goVersion: z.string().optional(),
});

/**
 * Container-level configuration schema
 */
export const ProjectContainerConfigSchema = z.object({
  /** Custom labels for the container */
  labels: z.record(z.string(), z.string()).optional(),
  /** Make container filesystem read-only */
  readOnlyRootFs: z.boolean().optional(),
  /** Linux capabilities to add/drop */
  capabilities: z
    .object({
      add: z.array(z.string()).optional(),
      drop: z.array(z.string()).optional(),
    })
    .optional(),
  /** Security options (seccomp, apparmor) */
  securityOpts: z.array(z.string()).optional(),
  /** Privileged mode (not recommended) */
  privileged: z.boolean().optional(),
  /** Host PID namespace */
  hostPid: z.boolean().optional(),
  /** Host network namespace */
  hostNetwork: z.boolean().optional(),
  /** Shared memory size */
  shmSize: z.string().optional(),
  /** Temporary filesystems */
  tmpfs: z
    .array(
      z.object({
        target: z.string(),
        size: z.string().optional(),
        mode: z.string().optional(),
      })
    )
    .optional(),
  /** Logging configuration */
  logging: z
    .object({
      driver: z.string().optional(),
      options: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});

/**
 * Port configuration schema
 */
export const ProjectPortConfigSchema = z.object({
  /** Port inside container */
  containerPort: z.number().int().positive(),
  /** Port on host (optional, auto-assigned if not specified) */
  hostPort: z.number().int().positive().optional(),
  /** Protocol */
  protocol: z.enum(["tcp", "udp"]).optional(),
  /** Bind address (0.0.0.0 for all, 127.0.0.1 for localhost) */
  hostIp: z.string().optional(),
  /** Publish mode (ingress for swarm, host for standard) */
  publishMode: z.enum(["ingress", "host"]).optional(),
  /** Expose port to linked services without publishing to host */
  exposedOnly: z.boolean().optional(),
});

/**
 * Networking configuration schema
 */
export const ProjectNetworkingConfigSchema = z.object({
  /** Network mode (bridge, host, none) */
  mode: z.enum(["bridge", "host", "none"]).optional(),
  /** Network aliases within project network */
  aliases: z.array(z.string()).optional(),
  /** Port mappings (exposed internally vs published to host) */
  ports: z.array(ProjectPortConfigSchema).optional(),
});

/**
 * Volume configuration schema
 */
export const ProjectVolumeConfigSchema = z.object({
  /** Path inside container */
  mountPath: z.string().min(1),
  /** Host path for bind mount (if present, it's a bind mount, not named volume) */
  hostPath: z.string().optional(),
  /** Custom volume name (auto-generated if not specified) */
  volumeName: z.string().optional(),
  /** Read-only or read-write */
  mode: z.enum(["RW", "RO"]).optional(),
  /** Volume propagation mode */
  propagation: z.enum(["private", "rprivate", "shared", "rshared", "slave", "rslave"]).optional(),
});

/**
 * Resource limits schema
 */
export const ProjectResourceConfigSchema = z.object({
  /** Memory limit (512m, 1g, etc.) */
  memory: z.string().optional(),
  /** Memory + swap limit */
  memorySwap: z.string().optional(),
  /** Memory reservation (soft limit) */
  memoryReservation: z.string().optional(),
  /** CPU limit (0.5 = 50% of one core, 2 = 2 cores) */
  cpus: z.number().nonnegative().optional(),
  /** CPU shares (relative weight, 1024 default) */
  cpuShares: z.number().int().positive().optional(),
  /** CPUs to use (0-3, 0,1) */
  cpuSet: z.string().optional(),
  /** CPU quota per period (microseconds) */
  cpuQuota: z.number().int().optional(),
  /** CPU period (microseconds, default 100000) */
  cpuPeriod: z.number().int().positive().optional(),
  /** Device access */
  devices: z
    .array(
      z.object({
        pathOnHost: z.string(),
        pathInContainer: z.string(),
        permissions: z.string().optional(),
      })
    )
    .optional(),
});

/**
 * Health check configuration schema
 */
export const ProjectHealthCheckConfigSchema = z.object({
  /** Command to run for health check */
  test: z.array(z.string()),
  /** Time between checks */
  interval: z.string().optional(),
  /** Time before counting as failure */
  timeout: z.string().optional(),
  /** Consecutive failures before unhealthy */
  retries: z.number().int().nonnegative().optional(),
  /** Grace period after startup before checks count */
  startPeriod: z.string().optional(),
});

/**
 * Lifecycle configuration schema
 */
export const ProjectLifecycleConfigSchema = z.object({
  /** Restart policy */
  restart: z.enum(["no", "always", "on-failure", "unless-stopped"]).optional(),
  /** Maximum retry count for on-failure */
  restartRetries: z.number().int().nonnegative().optional(),
  /** Automatically remove container when it exits */
  autoRemove: z.boolean().optional(),
  /** Stop timeout (grace period before SIGKILL) */
  stopTimeout: z.number().int().nonnegative().optional(),
  /** Stop signal (SIGTERM, SIGQUIT, etc.) */
  stopSignal: z.string().optional(),
});

interface IProjectConfig {
  build?: ProjectBuildConfig;
  runtime?: ProjectRuntimeConfig;
  container?: ProjectContainerConfig;
  networking?: ProjectNetworkingConfig;
  volumes?: ProjectVolumeConfig[];
  resources?: ProjectResourceConfig;
  healthCheck?: ProjectHealthCheckConfig;
  lifecycle?: ProjectLifecycleConfig;
  environments?: Record<string, IProjectConfig>;
}

export interface IPartialProjectConfig extends Partial<Omit<IProjectConfig, "environments">> {
  environments?: Record<string, IPartialProjectConfig>;
}

const PartialProjectConfigSchema: z.ZodType<IPartialProjectConfig> = z.lazy(() =>
  z.object({
    build: ProjectBuildConfigSchema.optional(),
    runtime: ProjectRuntimeConfigSchema.optional(),
    container: ProjectContainerConfigSchema.optional(),
    networking: ProjectNetworkingConfigSchema.optional(),
    volumes: z.array(ProjectVolumeConfigSchema).optional(),
    resources: ProjectResourceConfigSchema.optional(),
    healthCheck: ProjectHealthCheckConfigSchema.optional(),
    lifecycle: ProjectLifecycleConfigSchema.optional(),
    environments: z.record(z.string(), PartialProjectConfigSchema).optional(),
  })
);

/**
 * Full project configuration schema
 * Stored as JSON in the database
 */
export const ProjectConfigSchema = z.object({
  build: ProjectBuildConfigSchema.optional(),
  runtime: ProjectRuntimeConfigSchema.optional(),
  container: ProjectContainerConfigSchema.optional(),
  networking: ProjectNetworkingConfigSchema.optional(),
  volumes: z.array(ProjectVolumeConfigSchema).optional(),
  resources: ProjectResourceConfigSchema.optional(),
  healthCheck: ProjectHealthCheckConfigSchema.optional(),
  lifecycle: ProjectLifecycleConfigSchema.optional(),
  environments: z.record(z.string(), PartialProjectConfigSchema).optional(),
});

/**
 * Schema for creating/updating project config
 */
export const UpdateProjectConfigSchema = PartialProjectConfigSchema;

export type ProjectBuildConfig = z.infer<typeof ProjectBuildConfigSchema>;
export type ProjectRuntimeConfig = z.infer<typeof ProjectRuntimeConfigSchema>;
export type ProjectContainerConfig = z.infer<typeof ProjectContainerConfigSchema>;
export type ProjectPortConfig = z.infer<typeof ProjectPortConfigSchema>;
export type ProjectNetworkingConfig = z.infer<typeof ProjectNetworkingConfigSchema>;
export type ProjectVolumeConfig = z.infer<typeof ProjectVolumeConfigSchema>;
export type ProjectResourceConfig = z.infer<typeof ProjectResourceConfigSchema>;
export type ProjectHealthCheckConfig = z.infer<typeof ProjectHealthCheckConfigSchema>;
export type ProjectLifecycleConfig = z.infer<typeof ProjectLifecycleConfigSchema>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type UpdateProjectConfig = z.infer<typeof UpdateProjectConfigSchema>;
