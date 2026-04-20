import type { ServiceEngineDefinition } from "../types";
import { HEALTH_CHECK_TIMING } from "../utils";

export const rabbitmqEngine: ServiceEngineDefinition = {
  type: "QUEUE",
  engine: "rabbitmq",
  image: "rabbitmq",
  displayName: "RabbitMQ",
  description: "Feature-rich, multi-protocol message broker",
  icon: "ArrowRightLeft",
  supportedVersions: [
    { version: "3.12", imageTag: "3.12-management-alpine" },
    { version: "3.13", imageTag: "3.13-management-alpine" },
    { version: "4.0", imageTag: "4.0-management-alpine" },
  ],
  defaultVersion: "3.13",
  defaultPort: 5672,
  dataPath: "/var/lib/rabbitmq",

  defaultEnv: ({ username, password }) => ({
    RABBITMQ_DEFAULT_USER: username,
    RABBITMQ_DEFAULT_PASS: password,
  }),

  healthCheck: () => ({
    test: ["CMD-SHELL", "rabbitmq-diagnostics check_port_connectivity"],
    ...HEALTH_CHECK_TIMING,
    startPeriod: 60_000_000_000,
  }),

  connectionUrl: ({ hostname, port, username, password }) =>
    `amqp://${username}:${password}@${hostname}:${port}/`,

  connectionEnvVars: ({ envPrefix, hostname, port, username, password }) => ({
    [`${envPrefix}_HOST`]: hostname,
    [`${envPrefix}_PORT`]: String(port),
    [`${envPrefix}_URL`]: `amqp://${username}:${password}@${hostname}:${port}/`,
    [`${envPrefix}_USERNAME`]: username,
    [`${envPrefix}_PASSWORD`]: password,
    [`${envPrefix}_MANAGEMENT_PORT`]: "15672",
  }),

  configParameters: [],

  resourceDefaults: {
    memoryMB: 512,
    memoryReservationMB: 256,
    cpuShares: 512,
  },
};
