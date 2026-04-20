import type { ServiceEngineDefinition } from "../types";
import { HEALTH_CHECK_TIMING } from "../utils";

export const memcachedEngine: ServiceEngineDefinition = {
  type: "CACHE",
  engine: "memcached",
  image: "memcached",
  displayName: "Memcached",
  description: "High-performance distributed memory object caching system",
  icon: "Zap",
  supportedVersions: [{ version: "1.6", imageTag: "1.6-alpine" }],
  defaultVersion: "1.6",
  defaultPort: 11211,
  dataPath: "",

  defaultEnv: () => ({}),

  healthCheck: () => ({
    test: ["CMD-SHELL", "echo stats | nc localhost 11211"],
    ...HEALTH_CHECK_TIMING,
  }),

  connectionUrl: ({ hostname, port }) => `memcached://${hostname}:${port}`,

  connectionEnvVars: ({ envPrefix, hostname, port }) => ({
    [`${envPrefix}_HOST`]: hostname,
    [`${envPrefix}_PORT`]: String(port),
    [`${envPrefix}_URL`]: `memcached://${hostname}:${port}`,
  }),

  configParameters: [
    {
      key: "max_memory",
      label: "Max Memory (MB)",
      type: "integer",
      defaultValue: "64",
      envMapping: "MEMCACHED_MAX_MEMORY",
      description: "Maximum memory in megabytes",
    },
  ],

  resourceDefaults: {
    memoryMB: 256,
    memoryReservationMB: 128,
    cpuShares: 256,
  },
};
