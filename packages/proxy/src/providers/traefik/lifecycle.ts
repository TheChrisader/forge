import type { IContainerRuntime } from "@forge/docker";
import { TRAEFIK_CONTAINER_LABELS } from "./constants";

export interface TraefikLifecycleConfig {
  image: string;
  containerName: string;
  proxyNetworkName: string;
  httpPort: number;
  httpsPort: number;
  dashboard: boolean;
  logLevel: string;
  ssl: {
    enabled: boolean;
    email?: string;
  };
  volumeMounts: {
    dockerSocket: string;
  };
}

export interface ProxyStatus {
  healthy: boolean;
  running: boolean;
  containerId?: string;
  uptime?: number;
  routes: number;
  error?: string;
}

export class TraefikLifecycleManager {
  private containerId?: string;

  constructor(
    private readonly runtime: IContainerRuntime,
    private readonly config: TraefikLifecycleConfig
  ) {}

  async ensureProxyNetwork(): Promise<string> {
    const existing = await this.runtime.listNetworks({
      name: [this.config.proxyNetworkName],
    });

    if (existing.length > 0) {
      return this.config.proxyNetworkName;
    }

    await this.runtime.createNetwork({
      name: this.config.proxyNetworkName,
      driver: "bridge",
      internal: false,
      attachable: true,
      labels: {
        "forge.managed": "true",
        "forge.type": "proxy-network",
      },
    });

    return this.config.proxyNetworkName;
  }

  async ensureRunning(): Promise<{ containerId: string; created: boolean }> {
    const existing = await this.runtime.list({
      label: { "forge.traefik": "true" },
    });

    const existingContainer = existing.find(
      (c) => c.name === this.config.containerName || c.name === `/${this.config.containerName}`
    );

    if (existingContainer) {
      this.containerId = existingContainer.id;

      if (existingContainer.state.status !== "running") {
        await this.runtime.start(existingContainer.id);
      }

      return { containerId: existingContainer.id, created: false };
    }

    const command = this.buildCommand();

    const container = await this.runtime.create({
      image: this.config.image,
      name: this.config.containerName,
      cmd: command,
      ports: [
        { containerPort: this.config.httpPort, hostPort: this.config.httpPort, protocol: "tcp" },
        { containerPort: this.config.httpsPort, hostPort: this.config.httpsPort, protocol: "tcp" },
      ],
      volumes: [
        {
          source: this.config.volumeMounts.dockerSocket,
          target: "/var/run/docker.sock",
          readOnly: true,
        },
      ],
      labels: {
        [TRAEFIK_CONTAINER_LABELS.MANAGED]: "true",
        [TRAEFIK_CONTAINER_LABELS.TYPE]: "proxy",
        [TRAEFIK_CONTAINER_LABELS.TRAEFIK]: "true",
      },
      networks: [{ name: this.config.proxyNetworkName }],
      restartPolicy: { name: "unless-stopped" },
    });

    await this.runtime.start(container.id);
    this.containerId = container.id;

    return { containerId: container.id, created: true };
  }

  async connectToProjectNetwork(networkName: string): Promise<void> {
    if (!this.containerId) {
      throw new Error(
        "Traefik container ID not available — lifecycle manager was not properly initialized. " +
          "Ensure the factory's createProvider() was called and awaited."
      );
    }

    try {
      await this.runtime.connectNetwork(this.containerId, networkName);
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        return;
      }
      throw error;
    }
  }

  async disconnectFromProjectNetwork(networkName: string): Promise<void> {
    if (!this.containerId) {
      return;
    }

    try {
      await this.runtime.disconnectNetwork(this.containerId, networkName);
    } catch {
      // Ignore errors. Container may already be disconnected or removed
    }
  }

  async teardown(): Promise<void> {
    if (!this.containerId) {
      return;
    }

    try {
      await this.runtime.stop(this.containerId, { timeout: 10_000 });
      await this.runtime.remove(this.containerId, { force: true });
    } catch {
      // Ignore errors. Container may already be gone
    } finally {
      this.containerId = undefined;
    }
  }

  async getStatus(): Promise<ProxyStatus> {
    const proxiedContainers = await this.runtime.list({
      label: { "forge.proxy.enabled": "true" },
    });

    if (!this.containerId) {
      return {
        healthy: false,
        running: false,
        routes: proxiedContainers.length,
      };
    }

    try {
      const info = await this.runtime.inspect(this.containerId);
      const isRunning = info.state.status === "running";
      const isHealthy =
        !info.health || info.health.status === "healthy" || info.health.status === "none";

      let uptime: number | undefined;
      if (info.state.startedAt) {
        uptime = Date.now() - info.state.startedAt.getTime();
      }

      return {
        healthy: isRunning && isHealthy,
        running: isRunning,
        containerId: this.containerId,
        uptime,
        routes: proxiedContainers.length,
        error: !isHealthy && info.health?.log?.[0]?.output ? info.health.log[0].output : undefined,
      };
    } catch {
      return {
        healthy: false,
        running: false,
        containerId: this.containerId,
        routes: proxiedContainers.length,
        error: "Failed to inspect Traefik container",
      };
    }
  }

  getContainerId(): string | undefined {
    return this.containerId;
  }

  private buildCommand(): string[] {
    const flags: string[] = [
      "--providers.docker=true",
      "--providers.docker.exposedbydefault=false",
      `--providers.docker.network=${this.config.proxyNetworkName}`,
      `--entrypoints.web.address=:${this.config.httpPort}`,
      `--entrypoints.websecure.address=:${this.config.httpsPort}`,
    ];

    if (this.config.ssl.enabled && this.config.ssl.email) {
      flags.push(
        `--certificatesResolvers.letsencrypt.acme.email=${this.config.ssl.email}`,
        "--certificatesResolvers.letsencrypt.acme.storage=/letsencrypt/acme.json",
        "--certificatesResolvers.letsencrypt.acme.httpChallenge.entryPoint=web"
      );
    }

    if (this.config.dashboard) {
      flags.push("--api.dashboard=true");
      flags.push("--api.insecure=true");
    }

    flags.push(`--log.level=${this.config.logLevel}`);

    return flags;
  }
}
