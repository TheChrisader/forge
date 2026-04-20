import type { ServiceEngineDefinition } from "../types";
import { HEALTH_CHECK_TIMING } from "../utils";

export const minioEngine: ServiceEngineDefinition = {
  type: "STORAGE",
  engine: "minio",
  image: "minio/minio",
  displayName: "MinIO",
  description: "High-performance object storage compatible with Amazon S3",
  icon: "HardDrive",
  supportedVersions: [{ version: "latest", imageTag: "latest" }],
  defaultVersion: "latest",
  defaultPort: 9000,
  dataPath: "/data",

  defaultEnv: ({ username, password }) => ({
    MINIO_ROOT_USER: username,
    MINIO_ROOT_PASSWORD: password,
  }),

  healthCheck: () => ({
    test: ["CMD-SHELL", "mc ready local || curl -f http://localhost:9000/minio/health/live"],
    ...HEALTH_CHECK_TIMING,
  }),

  connectionUrl: ({ hostname, port, username, password }) =>
    `s3://${username}:${password}@${hostname}:${port}`,

  connectionEnvVars: ({ envPrefix, hostname, port, username, password }) => ({
    [`${envPrefix}_HOST`]: hostname,
    [`${envPrefix}_PORT`]: String(port),
    [`${envPrefix}_URL`]: `s3://${username}:${password}@${hostname}:${port}`,
    [`${envPrefix}_USERNAME`]: username,
    [`${envPrefix}_PASSWORD`]: password,
    [`${envPrefix}_CONSOLE_PORT`]: "9001",
    [`${envPrefix}_ENDPOINT`]: `http://${hostname}:${port}`,
    [`${envPrefix}_ACCESS_KEY`]: username,
    [`${envPrefix}_SECRET_KEY`]: password,
  }),

  configParameters: [],

  resourceDefaults: {
    memoryMB: 512,
    memoryReservationMB: 256,
    cpuShares: 512,
  },
};
