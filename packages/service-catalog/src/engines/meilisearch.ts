import type { ServiceEngineDefinition } from "../types";
import { HEALTH_CHECK_TIMING } from "../utils";

export const meilisearchEngine: ServiceEngineDefinition = {
  type: "SEARCH",
  engine: "meilisearch",
  image: "getmeili/meilisearch",
  displayName: "Meilisearch",
  description: "Fast, relevant search engine built in Rust",
  icon: "Search",
  supportedVersions: [
    { version: "v1.6", imageTag: "v1.6" },
    { version: "v1.7", imageTag: "v1.7" },
    { version: "v1.8", imageTag: "v1.8" },
  ],
  defaultVersion: "v1.8",
  defaultPort: 7700,
  dataPath: "/meili_data",

  defaultEnv: ({ password }) => ({
    MEILI_MASTER_KEY: password,
    MEILI_ENV: "production",
  }),

  healthCheck: () => ({
    test: ["CMD-SHELL", "curl -f http://localhost:7700/health"],
    ...HEALTH_CHECK_TIMING,
  }),

  connectionUrl: ({ hostname, port }) => `http://${hostname}:${port}`,

  connectionEnvVars: ({ envPrefix, hostname, port, password }) => ({
    [`${envPrefix}_HOST`]: hostname,
    [`${envPrefix}_PORT`]: String(port),
    [`${envPrefix}_URL`]: `http://${hostname}:${port}`,
    [`${envPrefix}_MASTER_KEY`]: password,
  }),

  configParameters: [],

  resourceDefaults: {
    memoryMB: 512,
    memoryReservationMB: 256,
    cpuShares: 256,
  },
};
