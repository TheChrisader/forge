import type { IContainerRuntime } from "@forge/docker";
import type {
  IReverseProxy,
  IReverseProxyFactory,
  ReverseProxyConfig,
  Route,
} from "./interfaces/proxy";
import type { IProxyIntegration } from "./interfaces/integration";
import { TraefikAdapter, type TraefikProviderConfig } from "./providers/traefik/adapter";
import { TraefikProxyIntegration } from "./providers/traefik/integration";
import { TraefikLifecycleManager } from "./providers/traefik/lifecycle";
import { NoOpProxyIntegration } from "./providers/noop/integration";

export interface ProxyProvider {
  proxy: IReverseProxy;
  integration: IProxyIntegration;
}

export class ReverseProxyFactory implements IReverseProxyFactory {
  constructor(private readonly runtime: IContainerRuntime) {}

  async create(config: ReverseProxyConfig): Promise<IReverseProxy> {
    return (await this.createProvider(config)).proxy;
  }

  async createProvider(config: ReverseProxyConfig): Promise<ProxyProvider> {
    const provider = config.type;

    if (provider === "none") {
      return {
        proxy: createNoOpProxy(),
        integration: new NoOpProxyIntegration(),
      };
    }

    if (provider === "traefik") {
      return this.createTraefikProvider(config);
    }

    throw new Error(`Proxy provider "${provider}" is not implemented. Supported: traefik, none`);
  }

  private async createTraefikProvider(config: ReverseProxyConfig): Promise<ProxyProvider> {
    const providerConfig: TraefikProviderConfig = {
      defaultDomain: config.domain ?? "localhost",
      httpsRedirect: config.ssl?.enabled ?? true,
      tlsResolver: config.ssl?.autoGenerate ? "letsencrypt" : undefined,
      proxyNetworkName: config.network ?? "forge-proxy",
      apiUrl: config.apiUrl,
    };

    const lifecycle = new TraefikLifecycleManager(this.runtime, {
      image: config.traefikImage ?? "traefik:v3",
      containerName: "forge-traefik",
      proxyNetworkName: providerConfig.proxyNetworkName,
      httpPort: config.httpPort ?? 80,
      httpsPort: config.httpsPort ?? 443,
      dashboard: config.dashboard ?? false,
      logLevel: config.logLevel ?? "INFO",
      ssl: {
        enabled: config.ssl?.enabled ?? true,
        email: config.ssl?.email,
      },
      volumeMounts: {
        dockerSocket: config.dockerSocketPath ?? "/var/run/docker.sock",
      },
    });

    await lifecycle.ensureRunning();

    return {
      proxy: new TraefikAdapter(this.runtime, lifecycle),
      integration: new TraefikProxyIntegration(lifecycle, providerConfig),
    };
  }
}

function createNoOpProxy(): IReverseProxy {
  return {
    addRoute(): Promise<void> {
      return Promise.resolve();
    },
    removeRoute(): Promise<void> {
      return Promise.resolve();
    },
    updateRoute(): Promise<void> {
      return Promise.resolve();
    },
    getRoutes(): Promise<Route[]> {
      return Promise.resolve([]);
    },
    getRoute(): Promise<null> {
      return Promise.resolve(null);
    },
    addCertificate(): Promise<void> {
      return Promise.resolve();
    },
    removeCertificate(): Promise<void> {
      return Promise.resolve();
    },
    addMiddleware(): Promise<void> {
      return Promise.resolve();
    },
    removeMiddleware(): Promise<void> {
      return Promise.resolve();
    },
    reload(): Promise<void> {
      return Promise.resolve();
    },
    getStatus(): Promise<{ healthy: boolean; routes: number; uptime: number }> {
      return Promise.resolve({ healthy: false, routes: 0, uptime: 0 });
    },
    toggleRoute(): Promise<void> {
      return Promise.resolve();
    },
    configureLoadBalancer(): Promise<void> {
      return Promise.resolve();
    },
  };
}
