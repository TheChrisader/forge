import { getDatabaseClient } from "@forge/database";
import { DockerRuntime } from "@forge/docker";
import { ReverseProxyFactory } from "@forge/proxy";
import type { IReverseProxy } from "@forge/proxy";
import { LoggerService } from "@forge/logger";
import type { LogLevel } from "@forge/types";

const POLL_INTERVAL_MS = 60_000;

interface HealthStatus {
  healthy: boolean;
  routes: number;
  uptime: number;
  previousHealthy: boolean | null;
  error?: string;
}

let currentStatus: HealthStatus = {
  healthy: false,
  routes: 0,
  uptime: 0,
  previousHealthy: null,
};

let proxy: IReverseProxy;
let pollTimer: ReturnType<typeof setInterval> | null = null;

const logger = new LoggerService({
  level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
  enabled: true,
  name: "proxy-health-monitor",
});

export async function startProxyHealthMonitor(): Promise<void> {
  const proxyProvider = process.env.PROXY_PROVIDER ?? "none";

  if (proxyProvider === "none") {
    logger.info("Proxy health monitor disabled — no proxy provider configured");
    return;
  }

  try {
    const runtime = new DockerRuntime();
    const proxyFactory = new ReverseProxyFactory(runtime);
    const { proxy: proxyInstance } = await proxyFactory.createProvider({
      type: proxyProvider as "traefik" | "caddy" | "nginx" | "custom",
      domain: process.env.PROXY_DOMAIN,
      network: process.env.PROXY_NETWORK,
      ssl: {
        enabled: process.env.PROXY_SSL_ENABLED !== "false",
        autoGenerate: process.env.PROXY_SSL_AUTO !== "false",
        email: process.env.PROXY_SSL_EMAIL,
      },
      dockerSocketPath: process.env.DOCKER_SOCKET,
    });

    proxy = proxyInstance;
  } catch (error) {
    logger.warn("Failed to initialize proxy for health monitoring", {
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  logger.info("Proxy health monitor started", { intervalMs: POLL_INTERVAL_MS });

  await checkProxyHealth();
  pollTimer = setInterval(checkProxyHealth, POLL_INTERVAL_MS);
}

export function stopProxyHealthMonitor(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    logger.info("Proxy health monitor stopped");
  }
}

async function checkProxyHealth(): Promise<void> {
  try {
    const status = await proxy.getStatus();

    if (status.healthy) {
      try {
        const db = getDatabaseClient();
        const expiringCerts = await db.domain.findMany({
          where: {
            sslStatus: "ACTIVE",
            sslExpiresAt: {
              lt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          },
        });

        if (expiringCerts.length > 0) {
          logger.warn("SSL certificates approaching expiration", {
            count: expiringCerts.length,
            domains: expiringCerts.map((c) => c.domain),
          });
        }
      } catch {
        // DB query failure shouldn't break health monitoring
      }
    }

    const previousHealthy = currentStatus.healthy;
    if (previousHealthy !== null && previousHealthy !== status.healthy) {
      if (status.healthy) {
        logger.info("Proxy became healthy", {
          routes: status.routes,
        });
      } else {
        logger.warn("Proxy became unhealthy", {
          previousRoutes: currentStatus.routes,
        });
      }
    }

    currentStatus = {
      healthy: status.healthy,
      routes: status.routes,
      uptime: status.uptime,
      previousHealthy,
    };
  } catch (error) {
    logger.error("Proxy health check failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    const previousHealthy = currentStatus.healthy;
    currentStatus = {
      ...currentStatus,
      healthy: false,
      previousHealthy,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function getProxyHealthStatus(): HealthStatus {
  return { ...currentStatus };
}
