import type { ServiceEngineDefinition } from "../types";
import { HEALTH_CHECK_TIMING } from "../utils";

export const natsEngine: ServiceEngineDefinition = {
  type: "QUEUE",
  engine: "nats",
  image: "nats",
  displayName: "NATS",
  description: "High-performance connective technology for modern distributed systems",
  icon: "ArrowRightLeft",
  supportedVersions: [{ version: "2.10", imageTag: "2.10-alpine" }],
  defaultVersion: "2.10",
  defaultPort: 4222,
  dataPath: "/data",

  defaultEnv: ({ username, password }) => ({
    NATS_USER: username,
    NATS_PASSWORD: password,
  }),

  healthCheck: () => ({
    test: ["CMD-SHELL", "curl -f http://localhost:8222/healthz"],
    ...HEALTH_CHECK_TIMING,
  }),

  connectionUrl: ({ hostname, port, username, password }) =>
    `nats://${username}:${password}@${hostname}:${port}`,

  connectionEnvVars: ({ envPrefix, hostname, port, username, password }) => ({
    [`${envPrefix}_HOST`]: hostname,
    [`${envPrefix}_PORT`]: String(port),
    [`${envPrefix}_URL`]: `nats://${username}:${password}@${hostname}:${port}`,
    [`${envPrefix}_USERNAME`]: username,
    [`${envPrefix}_PASSWORD`]: password,
  }),

  configParameters: [],

  resourceDefaults: {
    memoryMB: 128,
    memoryReservationMB: 64,
    cpuShares: 128,
  },
};
