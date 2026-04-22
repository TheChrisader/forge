import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { MetricsCollector } from "../collector";
import { METRIC_SOURCE_IDS } from "../types";
import type { MetricRecord } from "../types";
import type {
  PrometheusRegistry,
  PrometheusCounter,
  PrometheusHistogram,
} from "../prometheus/registry.js";

export interface HttpMetricsConfig {
  excludeRoutes?: string[];
  prometheusRegistry?: PrometheusRegistry;
}

const START_TIME_KEY = Symbol("metricsStartTime");

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const NUMERIC_ID_PATTERN = /\b\d{6,}\b/g;

const DEFAULT_EXCLUDED_ROUTES = ["/health", "/docs", "/metrics"];

function normalizeRoute(raw: string): string {
  let route = raw.split("?")[0];
  route = route.replace(UUID_PATTERN, ":id");
  route = route.replace(NUMERIC_ID_PATTERN, ":id");
  return route;
}

function isExcluded(route: string, exclusions: readonly string[]): boolean {
  return exclusions.some((prefix) => route === prefix || route.startsWith(prefix + "/"));
}

export function registerHttpMetrics(
  server: FastifyInstance,
  collector: MetricsCollector,
  config?: HttpMetricsConfig
): void {
  const excludedRoutes = config?.excludeRoutes ?? DEFAULT_EXCLUDED_ROUTES;

  server.addHook("onRequest", (request: FastifyRequest, _reply: FastifyReply, done: () => void) => {
    const route = normalizeRoute(request.url);
    if (isExcluded(route, excludedRoutes)) {
      return done();
    }
    (request as unknown as Record<symbol, bigint>)[START_TIME_KEY] = process.hrtime.bigint();
    done();
  });

  server.addHook("onResponse", (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
    const startTime = (request as unknown as Record<symbol, bigint>)[START_TIME_KEY];
    if (startTime === undefined) {
      return done();
    }

    const route = normalizeRoute(request.url);
    if (isExcluded(route, excludedRoutes)) {
      return done();
    }

    const durationNs = Number(process.hrtime.bigint() - startTime);
    const durationSeconds = durationNs / 1e9;
    const method = request.method;
    const status = String(reply.statusCode);

    const labels = { method, route, status };

    const records: MetricRecord[] = [
      {
        sourceType: "SYSTEM",
        sourceId: METRIC_SOURCE_IDS.api,
        sourceName: "Forge API",
        metric: "http_request_duration_seconds",
        value: durationSeconds,
        unit: "seconds",
        labels,
      },
      {
        sourceType: "SYSTEM",
        sourceId: METRIC_SOURCE_IDS.api,
        sourceName: "Forge API",
        metric: "http_requests_total",
        value: 1,
        unit: "count",
        labels,
      },
    ];

    if (reply.statusCode >= 500) {
      records.push({
        sourceType: "SYSTEM",
        sourceId: METRIC_SOURCE_IDS.api,
        sourceName: "Forge API",
        metric: "http_request_errors_total",
        value: 1,
        unit: "count",
        labels,
      });
    }

    collector.recordMany(records);

    if (config?.prometheusRegistry) {
      updatePrometheusMetrics(config.prometheusRegistry, labels, durationSeconds, reply.statusCode);
    }

    done();
  });
}

const REQUEST_DURATION_BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const PROM_LABEL_NAMES = ["method", "route", "status"] as const;

let lazyHistogram: PrometheusHistogram | undefined;
let lazyCounter: PrometheusCounter | undefined;
let lazyErrorCounter: PrometheusCounter | undefined;

function getOrCreateHistogram(registry: PrometheusRegistry): PrometheusHistogram {
  if (!lazyHistogram) {
    lazyHistogram = registry.getMetric("forge_http_request_duration_seconds") as
      | PrometheusHistogram
      | undefined;
    if (!lazyHistogram) {
      lazyHistogram = registry.createHistogram(
        "forge_http_request_duration_seconds",
        "HTTP request duration in seconds",
        [...REQUEST_DURATION_BUCKETS],
        [...PROM_LABEL_NAMES]
      );
    }
  }
  return lazyHistogram;
}

function getOrCreateCounter(registry: PrometheusRegistry): PrometheusCounter {
  if (!lazyCounter) {
    lazyCounter = registry.getMetric("forge_http_requests_total") as PrometheusCounter | undefined;
    if (!lazyCounter) {
      lazyCounter = registry.createCounter(
        "forge_http_requests_total",
        "Total HTTP requests processed",
        [...PROM_LABEL_NAMES]
      );
    }
  }
  return lazyCounter;
}

function getOrCreateErrorCounter(registry: PrometheusRegistry): PrometheusCounter {
  if (!lazyErrorCounter) {
    lazyErrorCounter = registry.getMetric("forge_http_request_errors_total") as
      | PrometheusCounter
      | undefined;
    if (!lazyErrorCounter) {
      lazyErrorCounter = registry.createCounter(
        "forge_http_request_errors_total",
        "Total HTTP requests resulting in 5xx errors",
        [...PROM_LABEL_NAMES]
      );
    }
  }
  return lazyErrorCounter;
}

function updatePrometheusMetrics(
  registry: PrometheusRegistry,
  labels: { method: string; route: string; status: string },
  durationSeconds: number,
  statusCode: number
): void {
  const histogram = getOrCreateHistogram(registry);
  histogram.observe(labels, durationSeconds);

  const counter = getOrCreateCounter(registry);
  counter.inc(labels);

  if (statusCode >= 500) {
    const errorCounter = getOrCreateErrorCounter(registry);
    errorCounter.inc(labels);
  }
}
