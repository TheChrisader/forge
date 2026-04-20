import type { ServiceEngineDefinition } from "../types";
import { HEALTH_CHECK_TIMING } from "../utils";

export const mongodbEngine: ServiceEngineDefinition = {
  type: "DATABASE",
  engine: "mongodb",
  image: "mongo",
  displayName: "MongoDB",
  description: "Document-oriented NoSQL database",
  icon: "Database",
  supportedVersions: [
    { version: "6", imageTag: "6" },
    { version: "7", imageTag: "7" },
    { version: "8", imageTag: "8" },
  ],
  defaultVersion: "7",
  defaultPort: 27017,
  dataPath: "/data/db",

  defaultEnv: ({ username, password }) => ({
    MONGO_INITDB_ROOT_USERNAME: username,
    MONGO_INITDB_ROOT_PASSWORD: password,
  }),

  healthCheck: () => ({
    test: ["CMD-SHELL", 'mongosh --eval "db.runCommand({ ping: 1 })" --quiet'],
    ...HEALTH_CHECK_TIMING,
  }),

  connectionUrl: ({ hostname, port, username, password, database }) =>
    `mongodb://${username}:${password}@${hostname}:${port}/${database}?authSource=admin`,

  connectionEnvVars: ({ envPrefix, hostname, port, username, password, database }) => ({
    [`${envPrefix}_HOST`]: hostname,
    [`${envPrefix}_PORT`]: String(port),
    [`${envPrefix}_URL`]: `mongodb://${username}:${password}@${hostname}:${port}/${database}?authSource=admin`,
    [`${envPrefix}_USERNAME`]: username,
    [`${envPrefix}_PASSWORD`]: password,
    [`${envPrefix}_DATABASE`]: database,
  }),

  configParameters: [],

  resourceDefaults: {
    memoryMB: 512,
    memoryReservationMB: 256,
    cpuShares: 512,
  },
};
