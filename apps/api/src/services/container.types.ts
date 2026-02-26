/**
 * Container service types
 *
 * Types specific to container management in the Forge platform.
 * Extends base Docker types with Forge-specific concepts.
 */

import type {
  ContainerConfig,
  PortMapping,
  ResourceLimits,
  ContainerHealthCheckConfig,
  RestartPolicy,
  ContainerStats,
  ExecResult,
  ExecOptions,
  LogOptions,
} from "@forge/types";

/**
 * Naming configuration for containers, networks, and volumes
 * Can be specified at project level in project.config.naming
 */
export interface NamingConfig {
  /**
   * Prefix for network names
   * Default: "forge-project"
   */
  networkPrefix?: string;

  /**
   * Prefix for volume names
   * Default: "forge-volume"
   */
  volumePrefix?: string;

  /**
   * Prefix for container names
   * Default: null (uses project slug directly)
   */
  containerPrefix?: string;

  /**
   * Whether to include project slug in generated names
   * Default: true
   */
  useProjectSlug?: boolean;
}

/**
 * Volume configuration for container creation
 * Supports both named volumes (Docker managed) and bind mounts (host paths)
 */
export interface ContainerVolumeConfig {
  /**
   * Path inside the container where the volume is mounted
   */
  mountPath: string;

  /**
   * Mount mode - read-write or read-only
   * Default: "RW"
   */
  mode?: "RW" | "RO";

  /**
   * For named volumes: custom volume name (overrides generated name)
   * If specified, a named volume will be created/used
   */
  volumeName?: string;

  /**
   * For bind mounts: host path to mount
   * If specified, binds directly to host path (no volume created)
   * Mutually exclusive with volumeName
   */
  hostPath?: string;
}

/**
 * Container creation configuration
 * Extends DockerRuntime's ContainerConfig with Forge-specific options
 */
export interface ContainerCreateConfig {
  /**
   * Project ID (required for database relationship)
   */
  projectId: string;

  /**
   * Deployment ID (required for database relationship)
   */
  deploymentId: string;

  /**
   * Docker image to run
   */
  image: string;

  /**
   * Container name (optional - will be generated if not provided)
   */
  name?: string;

  /**
   * Command to run (overrides image CMD)
   */
  cmd?: string[];

  /**
   * Entrypoint (overrides image ENTRYPOINT)
   */
  entrypoint?: string[];

  /**
   * Environment variables
   */
  env?: Record<string, string>;

  /**
   * Port mappings
   */
  ports?: PortMapping[];

  /**
   * Volume configurations (named or bind mounts)
   */
  volumes?: ContainerVolumeConfig[];

  /**
   * Network name (optional - will use project network if not provided)
   */
  networkName?: string;

  /**
   * Network aliases within the network
   */
  networkAliases?: string[];

  /**
   * Working directory inside the container
   */
  workingDir?: string;

  /**
   * User to run as inside the container
   */
  user?: string;

  /**
   * Resource limits
   */
  resources?: ResourceLimits;

  /**
   * Health check configuration
   */
  healthCheck?: ContainerHealthCheckConfig;

  /**
   * Restart policy
   */
  restartPolicy?: RestartPolicy;

  /**
   * Auto-remove container when it exits
   */
  autoRemove?: boolean;
}

/**
 * Result of container creation operation
 */
export interface ContainerCreateResult {
  /**
   * Docker container ID
   */
  containerId: string;

  /**
   * Database container record ID
   */
  dbId: string;

  /**
   * Container name
   */
  name: string;

  /**
   * Network the container was attached to
   */
  networkName: string;

  /**
   * Volumes that were created/used
   */
  volumes: Array<{
    mountPath: string;
    source: string;
    type: "named" | "bind";
  }>;
}

/**
 * Container list filters
 */
export interface ContainerListFilters {
  /**
   * Filter by status
   */
  status?: Array<"running" | "stopped" | "error">;

  /**
   * Filter by health status
   */
  healthStatus?: Array<"healthy" | "unhealthy" | "starting">;

  /**
   * Whether to include deleted containers
   */
  includeDeleted?: boolean;
}

// Re-export Docker types for convenience
export type {
  ContainerConfig,
  PortMapping,
  ResourceLimits,
  ContainerHealthCheckConfig,
  RestartPolicy,
  ContainerStats,
  ExecResult,
  ExecOptions,
  LogOptions,
};
