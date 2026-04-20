/**
 * Observer worker entry point
 *
 * Handles service reconciliation, orphan detection, and deployment health monitoring.
 * Delegates service-level observation to the ServiceHealthMonitor.
 */

import { ServiceHealthMonitor } from "../service-health-monitor.js";
import { LoggerService } from "@forge/logger";
import type { LogLevel } from "@forge/types";

const logger = new LoggerService({
  level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
  enabled: true,
  name: "observer",
});

async function observerMain(): Promise<void> {
  logger.info("Forge Observer Worker starting...");

  const monitor = new ServiceHealthMonitor({
    pollIntervalMs: 30_000,
    metricsEnabled: true,
  });

  const shutdown = async (signal: string): Promise<never> => {
    logger.info(`Received ${signal} — shutting down observer...`);
    await monitor.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    await monitor.start();
    logger.info("Forge Observer Worker started successfully");
  } catch (err) {
    logger.error("Failed to start observer", {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }
}

observerMain().catch((error) => {
  console.error("Failed to start observer worker:", error);
  process.exit(1);
});
