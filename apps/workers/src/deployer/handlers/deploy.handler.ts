import { getDatabaseClient } from "@forge/database";
import { DockerRuntime } from "@forge/docker";
import type { DeployJobData } from "@forge/types";
import type { IJobContext } from "@forge/queue";
import { LoggerService } from "@forge/logger";
import type { LogLevel } from "@forge/types";
import { BuildLogService } from "@forge/core";
import type { BuildLogSource } from "@forge/types";
import { ReverseProxyFactory, NoOpProxyIntegration } from "@forge/proxy";
import type { IProxyIntegration } from "@forge/proxy";
import { PriorityLogBuffer, parseBufferSize, parseErrorSlotReserve } from "./log-buffer.js";
import { FlushManager, createFlushManagerOptions } from "./flush-manager.js";
import type { DeployProgressCallback } from "../deployment-orchestrator.service.js";
import { DeploymentOrchestrator } from "../deployment-orchestrator.service.js";
import { emitProgress, initializeLineNumberRef } from "../../utils/progress-emitter.js";

const logger = new LoggerService({
  level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
  enabled: true,
  name: "deploy-handler",
});

export async function handleDeployJob(context: IJobContext<DeployJobData>): Promise<void> {
  const { deploymentId, projectId, image } = context.job.data;

  logger.info("Processing deploy job", { deploymentId, projectId, image });

  const db = getDatabaseClient();
  const buildLogService = new BuildLogService(db);
  const runtime = new DockerRuntime();

  const proxyProvider = process.env.PROXY_PROVIDER ?? "none";
  let proxyIntegration: IProxyIntegration;

  if (proxyProvider === "none") {
    proxyIntegration = new NoOpProxyIntegration();
  } else {
    try {
      const proxyFactory = new ReverseProxyFactory(runtime);
      const { integration } = await proxyFactory.createProvider({
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
      proxyIntegration = integration;
    } catch (proxyError) {
      logger.warn("Failed to initialize proxy integration — falling back to no-op", {
        provider: proxyProvider,
        error: proxyError instanceof Error ? proxyError.message : String(proxyError),
      });
      proxyIntegration = new NoOpProxyIntegration();
    }
  }

  const orchestrator = new DeploymentOrchestrator(db, runtime, logger, proxyIntegration);

  const lineNumberRef = await initializeLineNumberRef(buildLogService, deploymentId);

  logger.info("Deploy handler initialized", {
    deploymentId,
    lastLineNumber: lineNumberRef.value,
  });

  const bufferMaxSize = parseBufferSize(process.env.DEPLOY_LOG_BUFFER_SIZE, 500);
  const errorSlotReserve = parseErrorSlotReserve(process.env.DEPLOY_LOG_ERROR_SLOT_RESERVE, 0.1);

  const logBuffer = new PriorityLogBuffer({
    maxSize: bufferMaxSize,
    errorSlotReserve,
  });

  const flushManagerOptions = createFlushManagerOptions();
  const flushManager = new FlushManager(buildLogService, logger, flushManagerOptions);

  flushManager.scheduleFlush(logBuffer, deploymentId, () => {
    const stats = logBuffer.getStats();
    if (stats.droppedCount > 0) {
      logger.warn("Deploy logs have been dropped due to buffer pressure", {
        deploymentId,
        droppedCount: stats.droppedCount,
        droppedErrorCount: stats.droppedErrorCount,
        droppedGeneralCount: stats.droppedGeneralCount,
        utilizationPercent: stats.utilizationPercent.toFixed(1),
      });
    }
  });

  const progressCallback: DeployProgressCallback = async (event) => {
    await emitProgress(
      context,
      deploymentId,
      logBuffer,
      lineNumberRef,
      "DEPLOY" as BuildLogSource,
      logger,
      {
        message: event.message,
        level: event.level,
        stage: event.stage,
        progress: event.progress,
      }
    );
  };

  try {
    await orchestrator.deploy(deploymentId, image, {
      progressCallback,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await emitProgress(
      context,
      deploymentId,
      logBuffer,
      lineNumberRef,
      "DEPLOY" as BuildLogSource,
      logger,
      {
        message: `Deployment failed: ${errorMessage}`,
        level: "ERROR" as LogLevel,
        stage: "error",
      }
    );

    logger.error("Deployment failed", { deploymentId, error: errorMessage });

    await orchestrator.handleFailure(deploymentId, null, errorMessage);

    throw error;
  } finally {
    const finalResult = await flushManager.flush(logBuffer, deploymentId);
    flushManager.stop();

    const finalStats = logBuffer.getStats();
    logger.info("Deploy log buffer final statistics", {
      deploymentId,
      finalFlushSuccess: finalResult.success,
      totalEntriesProcessed: finalResult.entryCount,
      currentBufferSize: finalStats.currentSize,
      totalDropped: finalStats.droppedCount,
      droppedErrors: finalStats.droppedErrorCount,
      droppedGeneral: finalStats.droppedGeneralCount,
      circuitBreakerOpened: finalResult.circuitBreakerOpen,
      consecutiveFailures: finalResult.consecutiveFailures,
    });
  }
}
