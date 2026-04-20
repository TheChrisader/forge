import type { ServiceEngineDefinition } from "../types";
import { HEALTH_CHECK_TIMING_SLOW } from "../utils";

export const elasticsearchEngine: ServiceEngineDefinition = {
  type: "SEARCH",
  engine: "elasticsearch",
  image: "elasticsearch",
  displayName: "Elasticsearch",
  description: "Distributed search and analytics engine",
  icon: "Search",
  supportedVersions: [
    { version: "8.12", imageTag: "8.12.0", minMemoryMB: 1024 },
    { version: "8.13", imageTag: "8.13.0", minMemoryMB: 1024 },
    { version: "8.14", imageTag: "8.14.0", minMemoryMB: 1024 },
  ],
  defaultVersion: "8.14",
  defaultPort: 9200,
  dataPath: "/usr/share/elasticsearch/data",

  defaultEnv: () => ({
    "discovery.type": "single-node",
    "xpack.security.enabled": "false",
    ES_JAVA_OPTS: "-Xms512m -Xmx512m",
  }),

  healthCheck: () => ({
    test: ["CMD-SHELL", "curl -f http://localhost:9200/_cluster/health"],
    ...HEALTH_CHECK_TIMING_SLOW,
  }),

  connectionUrl: ({ hostname, port }) => `http://${hostname}:${port}`,

  connectionEnvVars: ({ envPrefix, hostname, port }) => ({
    [`${envPrefix}_HOST`]: hostname,
    [`${envPrefix}_PORT`]: String(port),
    [`${envPrefix}_URL`]: `http://${hostname}:${port}`,
  }),

  configParameters: [
    {
      key: "heap_size",
      label: "JVM Heap Size",
      type: "string",
      defaultValue: "512m",
      envMapping: "ES_JAVA_OPTS",
      description: "JVM heap size (format: -Xms<N>m -Xmx<N>m)",
    },
  ],

  resourceDefaults: {
    memoryMB: 1024,
    memoryReservationMB: 512,
    cpuShares: 1024,
  },
};
