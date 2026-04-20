import type { ServiceEngineDefinition } from "../types";
import { HEALTH_CHECK_TIMING } from "../utils";

export const redisEngine: ServiceEngineDefinition = {
  type: "CACHE",
  engine: "redis",
  image: "redis",
  displayName: "Redis",
  description: "In-memory data structure store, used as database, cache, and message broker",
  icon: "Zap",
  supportedVersions: [
    { version: "6", imageTag: "6-alpine" },
    { version: "7", imageTag: "7-alpine" },
    { version: "7.2", imageTag: "7.2-alpine" },
  ],
  defaultVersion: "7.2",
  defaultPort: 6379,
  dataPath: "/data",

  defaultEnv: ({ password }) => ({
    REDIS_PASSWORD: password,
  }),

  // The provisioner will replace "placeholder" with the actual password
  // when building the container config.
  healthCheck: () => ({
    test: ["CMD", "redis-cli", "-a", "placeholder", "ping"],
    ...HEALTH_CHECK_TIMING,
  }),

  connectionUrl: ({ hostname, port, password }) => `redis://:${password}@${hostname}:${port}/0`,

  connectionEnvVars: ({ envPrefix, hostname, port, password }) => ({
    [`${envPrefix}_HOST`]: hostname,
    [`${envPrefix}_PORT`]: String(port),
    [`${envPrefix}_URL`]: `redis://:${password}@${hostname}:${port}/0`,
    [`${envPrefix}_PASSWORD`]: password,
  }),

  configParameters: [
    {
      key: "maxmemory",
      label: "Max Memory",
      type: "string",
      defaultValue: "256mb",
      envMapping: "REDIS_MAXMEMORY",
      description: "Maximum memory Redis can use",
    },
    {
      key: "maxmemory_policy",
      label: "Eviction Policy",
      type: "string",
      defaultValue: "allkeys-lru",
      envMapping: "REDIS_MAXMEMORY_POLICY",
      description: "Key eviction policy when max memory is reached",
    },
  ],

  resourceDefaults: {
    memoryMB: 256,
    memoryReservationMB: 128,
    cpuShares: 256,
  },
};
