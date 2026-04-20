import type { ServiceEngineDefinition } from "../types";
import { HEALTH_CHECK_TIMING } from "../utils";

export const grafanaEngine: ServiceEngineDefinition = {
  type: "MONITORING",
  engine: "grafana",
  image: "grafana/grafana",
  displayName: "Grafana",
  description: "Open-source analytics and monitoring platform",
  icon: "Activity",
  supportedVersions: [
    { version: "10.3", imageTag: "10.3.0" },
    { version: "10.4", imageTag: "10.4.0" },
    { version: "11.0", imageTag: "11.0.0" },
  ],
  defaultVersion: "11.0",
  defaultPort: 3000,
  dataPath: "/var/lib/grafana",

  defaultEnv: ({ username, password }) => ({
    GF_SECURITY_ADMIN_USER: username,
    GF_SECURITY_ADMIN_PASSWORD: password,
  }),

  healthCheck: () => ({
    test: ["CMD-SHELL", "curl -f http://localhost:3000/api/health"],
    ...HEALTH_CHECK_TIMING,
  }),

  connectionUrl: ({ hostname, port }) => `http://${hostname}:${port}`,

  connectionEnvVars: ({ envPrefix, hostname, port, username, password }) => ({
    [`${envPrefix}_HOST`]: hostname,
    [`${envPrefix}_PORT`]: String(port),
    [`${envPrefix}_URL`]: `http://${hostname}:${port}`,
    [`${envPrefix}_USERNAME`]: username,
    [`${envPrefix}_PASSWORD`]: password,
  }),

  configParameters: [],

  resourceDefaults: {
    memoryMB: 256,
    memoryReservationMB: 128,
    cpuShares: 256,
  },
};
