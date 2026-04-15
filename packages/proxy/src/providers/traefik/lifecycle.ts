import type { IContainerRuntime } from "@forge/docker";
import { TRAEFIK_CONTAINER_LABELS } from "./constants";
import { validateCertFiles } from "../../utils/cert-files";
import { generateFullChain, generateTlsConfig } from "./tls-config";
import { resolve } from "path";

/**
 * Resolves a path relative to the project root.
 * Handles the case where the process is running from apps/api or apps/workers.
 */
function resolveProjectPath(relativePath: string): string {
  const cwd = process.cwd();

  // If running from apps/api or apps/workers, resolve relative to project root
  if (cwd.includes("/apps/") || cwd.includes("\\apps\\")) {
    // Find the apps directory and go up to project root
    const appsIndex = Math.max(cwd.lastIndexOf("/apps/"), cwd.lastIndexOf("\\apps\\"));
    const projectRoot = cwd.substring(0, appsIndex);
    return resolve(projectRoot, relativePath);
  }

  // Otherwise, resolve relative to current directory
  return resolve(cwd, relativePath);
}

export interface TraefikLifecycleConfig {
  image: string;
  containerName: string;
  proxyNetworkName: string;
  httpPort: number;
  httpsPort: number;
  dashboard: boolean;
  logLevel: string;
  /** URL where the Forge API is reachable from inside the Traefik container
   *  (e.g. "http://host.docker.internal:4000"). When set, the file-provider
   *  config includes an HTTP route that forwards CRL requests to the API. */
  apiUrl?: string;
  ssl: {
    enabled: boolean;
    mode?: "letsencrypt" | "selfsigned";
    email?: string;
    certPath?: string;
    caCertFile?: string;
    certFile?: string;
    keyFile?: string;
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

  /** Directory for Traefik-generated artifacts (fullchain, TOML config).
   *  Separate from the user-facing cert store to keep provider concerns isolated. */
  private static readonly PROVIDER_CONFIG_DIR = "./data/traefik";

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

    // For self-signed mode, validate certs and generate provider artifacts
    const certVolumes: Array<{ source: string; target: string; readOnly: boolean }> = [];
    if (this.config.ssl.enabled && this.config.ssl.mode === "selfsigned") {
      const certValidation = this.validateAndPrepareCerts();
      if (!certValidation.valid) {
        console.error(
          "[Traefik] Self-signed TLS mode enabled but certificate files are missing:\n" +
            "  " +
            certValidation.missing.join("\n  ") +
            "\n" +
            "  To fix this, run: pnpm setup:certs\n" +
            "  Falling back to HTTP-only mode."
        );
      } else {
        // Mount user's cert files (read-only)
        certVolumes.push({
          source: resolveProjectPath(this.config.ssl.certPath ?? "./data/certs"),
          target: "/certs",
          readOnly: true,
        });
        // Mount provider artifacts (read-only)
        certVolumes.push({
          source: resolveProjectPath(TraefikLifecycleManager.PROVIDER_CONFIG_DIR),
          target: "/traefik-config",
          readOnly: true,
        });
      }
    }

    const command = this.buildCommand();

    const volumes: Array<{ source: string; target: string; readOnly: boolean }> = [
      {
        source: this.config.volumeMounts.dockerSocket,
        target: "/var/run/docker.sock",
        readOnly: true,
      },
      ...certVolumes,
    ];

    const container = await this.runtime.create({
      image: this.config.image,
      name: this.config.containerName,
      cmd: command,
      ports: [
        { containerPort: this.config.httpPort, hostPort: this.config.httpPort, protocol: "tcp" },
        { containerPort: this.config.httpsPort, hostPort: this.config.httpsPort, protocol: "tcp" },
      ],
      volumes,
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

  private validateAndPrepareCerts(): { valid: boolean; missing: string[] } {
    const certPath = resolveProjectPath(this.config.ssl.certPath ?? "./data/certs");
    const caCertFile = this.config.ssl.caCertFile ?? "ca.crt";
    const certFile = this.config.ssl.certFile ?? "cert.crt";
    const keyFile = this.config.ssl.keyFile ?? "cert.key";
    const providerConfigDir = resolveProjectPath(TraefikLifecycleManager.PROVIDER_CONFIG_DIR);

    const validation = validateCertFiles(certPath, { caCertFile, certFile, keyFile });

    if (!validation.valid) {
      return validation;
    }

    // Generate Traefik-specific artifacts (fullchain and TOML config)
    if (validation.certSet) {
      try {
        generateFullChain(validation.certSet, providerConfigDir);
        // Fullchain is generated in providerConfigDir (mounted at /traefik-config)
        // Key is in the certPath (mounted at /certs)
        // Translate localhost → host.docker.internal so the Traefik container
        // can reach the Forge API on the host. Other proxy providers would
        // use the URL as-is — this translation is Traefik-specific.
        const containerApiUrl = this.config.apiUrl?.replace(
          "//localhost",
          "//host.docker.internal"
        );
        generateTlsConfig(
          "/traefik-config/fullchain.pem",
          "/certs/" + keyFile,
          providerConfigDir,
          containerApiUrl
        );
      } catch (error) {
        console.error("[Traefik] Failed to generate TLS config:", error);
        return {
          valid: false,
          missing: ["Failed to generate TLS config: " + (error as Error).message],
        };
      }
    }

    return validation;
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

    if (this.config.ssl.enabled) {
      if (this.config.ssl.mode === "selfsigned" && this.config.ssl.certPath) {
        // File provider for self-signed certs
        // /traefik-config/tls-config.toml references /certs/... and /traefik-config/...
        flags.push("--providers.file.filename=/traefik-config/tls-config.toml");
        flags.push("--providers.file.watch=true");
      } else if (this.config.ssl.email) {
        // ACME for Let's Encrypt (existing)
        flags.push(
          `--certificatesResolvers.letsencrypt.acme.email=${this.config.ssl.email}`,
          "--certificatesResolvers.letsencrypt.acme.storage=/letsencrypt/acme.json",
          "--certificatesResolvers.letsencrypt.acme.httpChallenge.entryPoint=web"
        );
      }
    }

    if (this.config.dashboard) {
      flags.push("--api.dashboard=true");
      flags.push("--api.insecure=true");
    }

    flags.push(`--log.level=${this.config.logLevel}`);

    return flags;
  }
}
