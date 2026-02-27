/**
 * Project Configuration Types
 *
 * These types define the configuration structure stored in Project.config (JSON field in database).
 * This is the user-facing configuration for deploying projects on the Forge platform.
 *
 * Types are generated from Zod schemas in ./schemas/project-config.ts
 */

export type {
  ProjectBuildConfig,
  ProjectRuntimeConfig,
  ProjectContainerConfig,
  ProjectPortConfig,
  ProjectNetworkingConfig,
  ProjectVolumeConfig,
  ProjectResourceConfig,
  ProjectHealthCheckConfig,
  ProjectLifecycleConfig,
  ProjectConfig,
  UpdateProjectConfig,
} from "./schemas/project-config";

export {
  ProjectBuildConfigSchema,
  ProjectRuntimeConfigSchema,
  ProjectContainerConfigSchema,
  ProjectPortConfigSchema,
  ProjectNetworkingConfigSchema,
  ProjectVolumeConfigSchema,
  ProjectResourceConfigSchema,
  ProjectHealthCheckConfigSchema,
  ProjectLifecycleConfigSchema,
  ProjectConfigSchema,
  UpdateProjectConfigSchema,
} from "./schemas/project-config";
