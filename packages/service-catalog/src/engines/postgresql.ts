import type { ServiceEngineDefinition } from "../types";
import { HEALTH_CHECK_TIMING } from "../utils";

export const postgresqlEngine: ServiceEngineDefinition = {
  type: "DATABASE",
  engine: "postgresql",
  image: "postgres",
  displayName: "PostgreSQL",
  description: "Advanced open-source relational database",
  icon: "Database",
  supportedVersions: [
    { version: "14", imageTag: "14-alpine" },
    { version: "15", imageTag: "15-alpine" },
    { version: "16", imageTag: "16-alpine" },
    { version: "17", imageTag: "17-alpine" },
  ],
  defaultVersion: "16",
  defaultPort: 5432,
  dataPath: "/var/lib/postgresql/data",

  defaultEnv: ({ username, password, database }) => ({
    POSTGRES_USER: username,
    POSTGRES_PASSWORD: password,
    POSTGRES_DB: database,
  }),

  healthCheck: () => ({
    test: ["CMD-SHELL", "pg_isready -U postgres"],
    ...HEALTH_CHECK_TIMING,
  }),

  connectionUrl: ({ hostname, port, username, password, database }) =>
    `postgresql://${username}:${password}@${hostname}:${port}/${database}`,

  connectionEnvVars: ({ envPrefix, hostname, port, username, password, database }) => ({
    [`${envPrefix}_HOST`]: hostname,
    [`${envPrefix}_PORT`]: String(port),
    [`${envPrefix}_URL`]: `postgresql://${username}:${password}@${hostname}:${port}/${database}`,
    [`${envPrefix}_USERNAME`]: username,
    [`${envPrefix}_PASSWORD`]: password,
    [`${envPrefix}_DATABASE`]: database,
  }),

  configParameters: [
    {
      key: "max_connections",
      label: "Max Connections",
      type: "integer",
      defaultValue: "100",
      envMapping: "POSTGRES_MAX_CONNECTIONS",
      description: "Maximum number of concurrent connections",
    },
  ],

  resourceDefaults: {
    memoryMB: 512,
    memoryReservationMB: 256,
    cpuShares: 512,
  },
};
