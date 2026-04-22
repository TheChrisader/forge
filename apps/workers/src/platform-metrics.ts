import { getDatabaseClient } from "@forge/database";
import { LoggerService } from "@forge/logger";
import type { LogLevel } from "@forge/core";
import { MetricsCollector, PlatformMetricsCollector } from "@forge/observability";
import type { QueueMetricsProvider } from "@forge/observability";

export interface PlatformMetricsWorkerDeps {
  queueMetricsProvider?: QueueMetricsProvider;
  collectionIntervalMs?: number;
  sharedCollector?: MetricsCollector;
}

export function createPlatformMetricsCollector(deps?: PlatformMetricsWorkerDeps): {
  collector: MetricsCollector;
  platformCollector: PlatformMetricsCollector;
  start: () => void;
  stop: () => Promise<void>;
} {
  const db = getDatabaseClient();

  let collector: MetricsCollector;
  const ownsCollector = !deps?.sharedCollector;

  if (deps?.sharedCollector) {
    collector = deps.sharedCollector;
  } else {
    const logger = new LoggerService({
      level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
      format: process.env.NODE_ENV === "development" ? "pretty" : "json",
      enabled: true,
      name: "platform-metrics",
    });
    collector = new MetricsCollector(db, logger);
  }

  const platformCollector = new PlatformMetricsCollector(
    db,
    collector,
    deps?.queueMetricsProvider,
    {
      intervalMs: deps?.collectionIntervalMs,
    }
  );

  return {
    collector,
    platformCollector,
    start: (): void => {
      if (ownsCollector) {
        collector.start();
      }
      platformCollector.start();
    },
    stop: async (): Promise<void> => {
      platformCollector.stop();
      if (ownsCollector) {
        await collector.stop();
      }
    },
  };
}
