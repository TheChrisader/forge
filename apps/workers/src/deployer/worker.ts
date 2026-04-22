import type { ILogger } from "@forge/core";
import { LoggerService } from "@forge/logger";
import type { LogLevel } from "@forge/core";
import { QueueService, type QueueConfig } from "@forge/queue";
import { DockerRuntime } from "@forge/docker";
import type { DeployJobData } from "@forge/types";
import type { IJobContext } from "@forge/queue";
import { ReverseProxyFactory, NoOpProxyIntegration } from "@forge/proxy";
import type { IProxyIntegration } from "@forge/proxy";
import { getDatabaseClient } from "@forge/database";
import { handleDeployJob } from "./handlers/deploy.handler.js";
import { DeploymentReconciler } from "./deployment-reconciler.js";

export interface DeployerWorkerOptions {
  concurrency?: number;
  limiter?: {
    max: number;
    duration: number;
  };
}

export class DeployerWorker {
  private queueService: QueueService;
  private logger: ILogger;
  private runtime: DockerRuntime;
  private proxyIntegration!: IProxyIntegration;
  private reconciler: DeploymentReconciler | null = null;
  private workerName = "deployer-worker";
  private readonly config: QueueConfig;

  constructor(
    config: QueueConfig,
    private readonly options?: DeployerWorkerOptions
  ) {
    this.config = config;
    this.logger = new LoggerService({
      level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
      format: process.env.NODE_ENV === "development" ? "pretty" : "json",
      enabled: true,
      name: this.workerName,
    });

    this.queueService = new QueueService(config);
    this.runtime = new DockerRuntime();

    this.logger.info("Deployer worker created — awaiting initialization");
  }

  async initialize(): Promise<void> {
    this.proxyIntegration = await this.initializeProxyIntegration();

    const worker = this.queueService.registerWorker(
      "deploy",
      (context: IJobContext<DeployJobData>) =>
        handleDeployJob(context, this.proxyIntegration, this.runtime, this.config),
      {
        concurrency: this.options?.concurrency ?? 5,
        limiter: this.options?.limiter ?? {
          max: 20,
          duration: 60_000,
        },
      }
    );

    worker.onCompleted((job) => {
      this.logger.info("Deploy job completed", { jobId: job.id });
    });

    worker.onFailed((job, err) => {
      this.logger.error("Deploy job failed", { jobId: job?.id, error: err.message });
    });

    this.logger.info("Deployer worker initialized and ready");

    this.reconciler = new DeploymentReconciler(getDatabaseClient(), this.runtime, this.logger);
    await this.reconciler.start();
  }

  private async initializeProxyIntegration(): Promise<IProxyIntegration> {
    const proxyProvider = process.env.PROXY_PROVIDER ?? "none";

    if (proxyProvider === "none") {
      return new NoOpProxyIntegration();
    }

    try {
      const factory = new ReverseProxyFactory(this.runtime);
      const { integration } = await factory.createProvider({
        type: proxyProvider as "traefik" | "caddy" | "nginx" | "custom",
        domain: process.env.PROXY_DOMAIN,
        httpPort: process.env.PROXY_HTTP_PORT
          ? parseInt(process.env.PROXY_HTTP_PORT, 10)
          : undefined,
        httpsPort: process.env.PROXY_HTTPS_PORT
          ? parseInt(process.env.PROXY_HTTPS_PORT, 10)
          : undefined,
        network: process.env.PROXY_NETWORK,
        ssl: {
          enabled: process.env.PROXY_SSL_ENABLED !== "false",
          mode: (process.env.PROXY_SSL_MODE ?? "letsencrypt") as "letsencrypt" | "selfsigned",
          autoGenerate: process.env.PROXY_SSL_AUTO !== "false",
          email: process.env.PROXY_SSL_EMAIL,
          certPath: process.env.PROXY_CERT_PATH,
          caCertFile: process.env.PROXY_CA_CERT_FILE,
          certFile: process.env.PROXY_CERT_FILE,
          keyFile: process.env.PROXY_KEY_FILE,
        },
        dashboard: process.env.PROXY_DASHBOARD === "true",
        traefikImage: process.env.PROXY_TRAEFIK_IMAGE,
        logLevel: process.env.PROXY_LOG_LEVEL,
        dockerSocketPath: process.env.DOCKER_SOCKET,
      });
      return integration;
    } catch (error) {
      this.logger.warn("Failed to initialize proxy — falling back to no-op", {
        provider: proxyProvider,
        error: error instanceof Error ? error.message : String(error),
      });
      return new NoOpProxyIntegration();
    }
  }

  async close(): Promise<void> {
    this.logger.info("Shutting down deployer worker...");
    this.reconciler?.stop();
    await this.queueService.close();
    this.logger.info("Deployer worker shut down");
  }
}
