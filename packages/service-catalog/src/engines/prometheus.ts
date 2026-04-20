import type { ServiceEngineDefinition } from "../types";
import { HEALTH_CHECK_TIMING_SLOW } from "../utils";

export const prometheusEngine: ServiceEngineDefinition = {
  type: "MONITORING",
  engine: "prometheus",
  image: "prom/prometheus",
  displayName: "Prometheus",
  description: "Open-source monitoring and alerting toolkit",
  icon: "Activity",
  supportedVersions: [
    { version: "v2.50", imageTag: "v2.50.0" },
    { version: "v2.51", imageTag: "v2.51.0" },
    { version: "v2.52", imageTag: "v2.52.0" },
  ],
  defaultVersion: "v2.52",
  defaultPort: 9090,
  dataPath: "/prometheus",

  defaultEnv: () => ({}),

  healthCheck: () => ({
    test: ["CMD-SHELL", "curl -f http://localhost:9090/-/healthy"],
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
      key: "retention_time",
      label: "Retention Time",
      type: "string",
      defaultValue: "15d",
      envMapping: "PROMETHEUS_RETENTION",
      description: "How long to retain metrics data",
    },
  ],

  resourceDefaults: {
    memoryMB: 512,
    memoryReservationMB: 256,
    cpuShares: 512,
  },
};
