import type { IContainerRuntime, Container, ContainerFilters } from "@forge/docker";
import type {
  IReverseProxy,
  Route,
  Certificate,
  Middleware,
  LoadBalancer,
} from "../../interfaces/proxy";
import { FORGE_PROXY_LABELS, TRAEFIK_CONTAINER_LABELS } from "./constants";
import type { TraefikLifecycleManager, ProxyStatus } from "./lifecycle";

export interface TraefikProviderConfig {
  defaultDomain: string;
  httpsRedirect: boolean;
  tlsResolver?: string;
  proxyNetworkName: string;
  apiUrl?: string;
}

export class TraefikAdapter implements IReverseProxy {
  constructor(
    private readonly runtime: IContainerRuntime,
    private readonly lifecycle: TraefikLifecycleManager
  ) {}

  async addRoute(_route: Route): Promise<void> {
    // Routes are configured at deploy time via IProxyIntegration.prepareContainer().
    // For Traefik with Docker provider, labels cannot be updated at runtime.
    // This is a no-op — the caller should use the deployment pipeline for route changes.
  }

  async removeRoute(_id: string): Promise<void> {
    // Routes are configured at deploy time via IProxyIntegration.prepareContainer().
    // For Traefik with Docker provider, labels cannot be updated at runtime.
    // This is a no-op — the caller should use the deployment pipeline for route changes.
  }

  async updateRoute(_id: string, _updates: Partial<Route>): Promise<void> {
    // Routes are configured at deploy time via IProxyIntegration.prepareContainer().
    // For Traefik with Docker provider, labels cannot be updated at runtime.
    // This is a no-op — the caller should use the deployment pipeline for route changes.
  }

  async getRoutes(): Promise<Route[]> {
    const filters: ContainerFilters = {
      label: { [FORGE_PROXY_LABELS.ENABLED]: "true" },
    };

    const containers = await this.runtime.list(filters);
    const routes: Route[] = [];

    for (const container of containers) {
      const labels = container.labels || {};
      const routeId = labels[FORGE_PROXY_LABELS.ROUTE_ID];
      const domain = labels[FORGE_PROXY_LABELS.DOMAIN];

      if (routeId && domain) {
        routes.push({
          id: routeId,
          domain,
          target: container.id,
          path: undefined,
          preserveHost: true,
        });
      }
    }

    return routes;
  }

  async getRoute(id: string): Promise<Route | null> {
    const containers = await this.findContainerByRouteId(id);
    if (containers.length === 0) {
      return null;
    }

    const container = containers[0];
    const labels = container.labels || {};
    const domain = labels[FORGE_PROXY_LABELS.DOMAIN];

    return {
      id,
      domain: domain || "",
      target: container.id,
      preserveHost: true,
    };
  }

  addCertificate(_cert: Certificate): Promise<void> {
    // Custom certificate management requires the Traefik file provider.
    // For Traefik with Docker provider, use ACME auto-generation.
    return Promise.resolve();
  }

  removeCertificate(_domain: string): Promise<void> {
    return Promise.resolve();
  }

  addMiddleware(_middleware: Middleware): Promise<void> {
    // Middleware in Traefik's Docker provider is configured via container labels
    // at deploy time. Use IProxyIntegration.prepareContainer() instead.
    return Promise.resolve();
  }

  removeMiddleware(_id: string): Promise<void> {
    return Promise.resolve();
  }

  reload(): Promise<void> {
    // Traefik with Docker provider auto-reloads on container changes. No-op.
    return Promise.resolve();
  }

  async getStatus(): Promise<{ healthy: boolean; routes: number; uptime: number }> {
    const status: ProxyStatus = await this.lifecycle.getStatus();
    return {
      healthy: status.healthy,
      routes: status.routes,
      uptime: status.uptime ?? 0,
    };
  }

  async toggleRoute(_id: string, _enabled: boolean): Promise<void> {
    // Routes are configured at deploy time via IProxyIntegration.prepareContainer().
    // For Traefik with Docker provider, labels cannot be updated at runtime.
    // This is a no-op — the caller should use the deployment pipeline for route changes.
  }

  configureLoadBalancer(_routeId: string, _lbConfig: LoadBalancer): Promise<void> {
    // Load balancer configuration in Traefik is set via container labels at deploy time.
    return Promise.resolve();
  }

  private async findContainerByRouteId(
    routeId: string
  ): Promise<ReturnType<typeof this.runtime.list>> {
    return this.runtime.list({
      label: { [FORGE_PROXY_LABELS.ROUTE_ID]: routeId },
    });
  }

  async getTraefikContainer(): Promise<Container | null> {
    const containers = await this.runtime.list({
      label: { [TRAEFIK_CONTAINER_LABELS.TRAEFIK]: "true" },
    });
    return containers[0] ?? null;
  }
}
