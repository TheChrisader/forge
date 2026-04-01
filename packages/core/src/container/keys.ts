export const SERVICE_KEYS = {
  DATABASE: Symbol.for("forge:database"),
  CACHE: Symbol.for("forge:cache"),
  QUEUE: Symbol.for("forge:queue"),

  CONTAINER_RUNTIME: Symbol.for("forge:container-runtime"),

  STORAGE: Symbol.for("forge:storage"),
  STORAGE_FACTORY: Symbol.for("forge:storage-factory"),

  REVERSE_PROXY: Symbol.for("forge:reverse-proxy"),
  REVERSE_PROXY_FACTORY: Symbol.for("forge:reverse-proxy-factory"),

  BUILD_SERVICE: Symbol.for("forge:build-service"),
  BUILD_STRATEGY_REGISTRY: Symbol.for("forge:build-strategy-registry"),
  BUILD_CACHE_SERVICE: Symbol.for("forge:build-cache-service"),

  DEPLOYMENT_SERVICE: Symbol.for("forge:deployment-service"),
  DEPLOYMENT_STRATEGY_REGISTRY: Symbol.for("forge:deployment-strategy-registry"),

  PROJECT_SERVICE: Symbol.for("forge:project-service"),
  SERVICE_SERVICE: Symbol.for("forge:service-service"), // alias for backward compatibility
  SERVICE_MANAGEMENT_SERVICE: Symbol.for("forge:service-management-service"),
  CONTAINER_SERVICE: Symbol.for("forge:container-service"),
  LOG_SERVICE: Symbol.for("forge:log-service"),
  METRICS_SERVICE: Symbol.for("forge:metrics-service"),
  SECRET_SERVICE: Symbol.for("forge:secret-service"),
  PERMISSIONS_SERVICE: Symbol.for("forge:permissions-service"),
  SESSION_SERVICE: Symbol.for("forge:session-service"),
  INVITATION_SERVICE: Symbol.for("forge:invitation-service"),

  NOTIFICATION_PROVIDER: Symbol.for("forge:notification-provider"),
  AUTH_PROVIDER: Symbol.for("forge:auth-provider"),

  PLUGIN_MANAGER: Symbol.for("forge:plugin-manager"),

  CONFIG: Symbol.for("forge:config"),

  LOGGER: Symbol.for("forge:logger"),

  SSE_MANAGER: Symbol.for("forge:sse-manager"),
  MESSAGE_BATCHER: Symbol.for("forge:message-batcher"),
} as const;

export const SERVICE_KEY_STRINGS = {
  DATABASE: "database",
  CACHE: "cache",
  QUEUE: "queue",
  CONTAINER_RUNTIME: "containerRuntime",
  STORAGE: "storage",
  STORAGE_FACTORY: "storageFactory",
  REVERSE_PROXY: "reverseProxy",
  REVERSE_PROXY_FACTORY: "reverseProxyFactory",
  BUILD_SERVICE: "buildService",
  BUILD_STRATEGY_REGISTRY: "buildStrategyRegistry",
  BUILD_CACHE_SERVICE: "buildCacheService",
  DEPLOYMENT_SERVICE: "deploymentService",
  DEPLOYMENT_STRATEGY_REGISTRY: "deploymentStrategyRegistry",
  PROJECT_SERVICE: "projectService",
  SERVICE_SERVICE: "serviceService", // alias for backward compatibility
  SERVICE_MANAGEMENT_SERVICE: "serviceManagementService",
  PERMISSIONS_SERVICE: "permissionsService",
  SESSION_SERVICE: "sessionService",
  INVITATION_SERVICE: "invitationService",
  CONTAINER_SERVICE: "containerService",
  LOG_SERVICE: "logService",
  METRICS_SERVICE: "metricsService",
  SECRET_SERVICE: "secretService",
  NOTIFICATION_PROVIDER: "notificationProvider",
  AUTH_PROVIDER: "authProvider",
  PLUGIN_MANAGER: "pluginManager",
  CONFIG: "config",
  LOGGER: "logger",
  SSE_MANAGER: "sseManager",
  MESSAGE_BATCHER: "messageBatcher",
} as const;

export type ServiceKey = keyof typeof SERVICE_KEY_STRINGS;
