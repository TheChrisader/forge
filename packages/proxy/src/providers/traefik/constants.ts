export const FORGE_PROXY_LABELS = {
  ENABLED: "forge.proxy.enabled",
  ROUTE_ID: "forge.proxy.routeId",
  DOMAIN: "forge.proxy.domain",
  TARGET_PORT: "forge.proxy.targetPort",
  PROJECT_ID: "forge.proxy.projectId",
  DEPLOYMENT_ID: "forge.proxy.deploymentId",
} as const;

export const TRAEFIK_CONTAINER_LABELS = {
  MANAGED: "forge.managed",
  TYPE: "forge.type",
  TRAEFIK: "forge.traefik",
} as const;
