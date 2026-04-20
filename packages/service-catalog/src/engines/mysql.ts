import type { ServiceEngineDefinition } from "../types";
import { HEALTH_CHECK_TIMING } from "../utils";

export const mysqlEngine: ServiceEngineDefinition = {
  type: "DATABASE",
  engine: "mysql",
  image: "mysql",
  displayName: "MySQL",
  description: "World's most popular open-source database",
  icon: "Database",
  supportedVersions: [
    { version: "8.0", imageTag: "8.0" },
    { version: "8.4", imageTag: "8.4" },
    { version: "9.0", imageTag: "9.0" },
  ],
  defaultVersion: "8.4",
  defaultPort: 3306,
  dataPath: "/var/lib/mysql",

  defaultEnv: ({ username, password, database }) => ({
    MYSQL_ROOT_PASSWORD: password,
    MYSQL_USER: username,
    MYSQL_PASSWORD: password,
    MYSQL_DATABASE: database,
  }),

  healthCheck: () => ({
    test: ["CMD-SHELL", "mysqladmin ping -h localhost -u root -p${MYSQL_ROOT_PASSWORD}"],
    ...HEALTH_CHECK_TIMING,
  }),

  connectionUrl: ({ hostname, port, username, password, database }) =>
    `mysql://${username}:${password}@${hostname}:${port}/${database}`,

  connectionEnvVars: ({ envPrefix, hostname, port, username, password, database }) => ({
    [`${envPrefix}_HOST`]: hostname,
    [`${envPrefix}_PORT`]: String(port),
    [`${envPrefix}_URL`]: `mysql://${username}:${password}@${hostname}:${port}/${database}`,
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
