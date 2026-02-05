export const SERVICE_KEYS = {
  DATABASE: Symbol.for("forge:database"),
  CACHE: Symbol.for("forge:cache"),
  QUEUE: Symbol.for("forge:queue"),

  CONTAINER_RUNTIME: Symbol.for("forge:container-runtime"),

  STORAGE: Symbol.for("forge:storage"),

  REVERSE_PROXY: Symbol.for("forge:reverse-proxy"),

  PROJECT_SERVICE: Symbol.for("forge:project-service"),
  DEPLOYMENT_SERVICE: Symbol.for("forge:deployment-service"),
  BUILD_SERVICE: Symbol.for("forge:build-service"),
  SERVICE_SERVICE: Symbol.for("forge:service-service"),

  CONFIG: Symbol.for("forge:config"),

  LOGGER: Symbol.for("forge:logger"),
} as const;

// string keys (for cases where symbols can't be used)
export const SERVICE_KEY_STRINGS = {
  DATABASE: "database",
  CACHE: "cache",
  QUEUE: "queue",
  CONTAINER_RUNTIME: "containerRuntime",
  STORAGE: "storage",
  REVERSE_PROXY: "reverseProxy",
  PROJECT_SERVICE: "projectService",
  DEPLOYMENT_SERVICE: "deploymentService",
  BUILD_SERVICE: "buildService",
  SERVICE_SERVICE: "serviceService",
  CONFIG: "config",
  LOGGER: "logger",
} as const;

export type ServiceKey = keyof typeof SERVICE_KEY_STRINGS;
