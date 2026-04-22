import type { FastifyInstance } from "fastify";
import type { MetricsCollector, PrometheusRegistry } from "@forge/observability";
import { registerHttpMetrics } from "@forge/observability";

export function registerMetricsMiddleware(
  server: FastifyInstance,
  collector: MetricsCollector,
  prometheusRegistry?: PrometheusRegistry
): void {
  registerHttpMetrics(server, collector, {
    excludeRoutes: ["/health", "/docs", "/metrics"],
    prometheusRegistry,
  });
}
