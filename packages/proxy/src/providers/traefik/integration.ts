import type {
  IProxyIntegration,
  ProxyContainerContext,
  ProxyContainerRequirements,
  ProxyDeployedContext,
  ProxyDeployResult,
  ProxyRemovedContext,
} from "../../interfaces/integration";
import { buildTraefikLabels } from "./labels";
import { FORGE_PROXY_LABELS } from "./constants";
import type { TraefikLifecycleManager } from "./lifecycle";
import type { TraefikProviderConfig } from "./adapter";

export class TraefikProxyIntegration implements IProxyIntegration {
  constructor(
    private readonly lifecycle: TraefikLifecycleManager,
    private readonly config: TraefikProviderConfig
  ) {}

  async initialize(): Promise<void> {
    await this.lifecycle.ensureProxyNetwork();
    await this.lifecycle.ensureRunning();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async prepareContainer(context: ProxyContainerContext): Promise<ProxyContainerRequirements> {
    const autoSubdomain = `${context.projectSlug}.${this.config.defaultDomain}`;
    const allDomains = [autoSubdomain, ...context.domains];

    const routeId = this.buildRouteId(context.projectId);

    const traefikLabels = buildTraefikLabels({
      routeId,
      domains: allDomains,
      targetPort: context.targetPort,
      httpsRedirect: this.config.httpsRedirect,
      tlsResolver: this.config.tlsResolver,
      tlsEnabled: this.config.tlsEnabled,
      enabled: true,
    });

    const forgeLabels: Record<string, string> = {
      [FORGE_PROXY_LABELS.ENABLED]: "true",
      [FORGE_PROXY_LABELS.ROUTE_ID]: routeId,
      [FORGE_PROXY_LABELS.DOMAIN]: autoSubdomain,
      [FORGE_PROXY_LABELS.TARGET_PORT]: String(context.targetPort),
      [FORGE_PROXY_LABELS.PROJECT_ID]: context.projectId,
      [FORGE_PROXY_LABELS.DEPLOYMENT_ID]: context.deploymentId,
    };

    return {
      labels: { ...traefikLabels, ...forgeLabels },
      additionalNetworks: [{ name: this.config.proxyNetworkName }],
    };
  }

  async onContainerDeployed(context: ProxyDeployedContext): Promise<ProxyDeployResult> {
    await this.lifecycle.connectToProjectNetwork(context.networkName);

    const url = this.generateDeploymentUrl(context.projectSlug, true);
    return { urls: [url] };
  }

  async onContainerRemoved(_context: ProxyRemovedContext): Promise<void> {
    // For Traefik with Docker provider, labels die with the container.
    // Traefik auto-removes the route. No explicit cleanup needed.
  }

  generateDeploymentUrl(projectSlug: string, _isPrimary: boolean): string {
    const protocol = this.config.httpsRedirect ? "https" : "http";
    return `${protocol}://${projectSlug}.${this.config.defaultDomain}`;
  }

  private buildRouteId(projectId: string): string {
    return `forge-${projectId.substring(0, 8)}`;
  }
}
