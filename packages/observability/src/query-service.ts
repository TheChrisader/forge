import type { PrismaClient, SourceType } from "@forge/database";
import type { LoggerService } from "@forge/logger";
import {
  MetricsQueryBuilder,
  type MetricSource,
  type LatestMetricValue,
  type TopSourceResult,
} from "./query-builder";
import { metricRegistry } from "./registry";
import type { AggregationFunction, MetricsQuery, TimeBucketInterval } from "./types";

function parseLookback(lookback: string): number {
  const match = lookback.match(/^(\d+)([mhd])$/);
  if (!match)
    throw new Error(`Invalid lookback format: "${lookback}". Use e.g. "1h", "30m", "7d".`);
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

export interface TimeSeriesResult {
  metric: string;
  sourceType: SourceType;
  sourceId: string;
  sourceName: string;
  unit: string | null;
  labels: Record<string, string> | null;
  points: { timestamp: string; value: number; sampleCount?: number }[];
}

export interface SourceSummary {
  sourceType: SourceType;
  sourceId: string;
  sourceName: string;
  projectId: string | null;
  metrics: { metric: string; value: number; unit: string; timestamp: string }[];
}

export interface PlatformSummary {
  containers: { total: number; active: number };
  deployments: { total: number; active: number; successRate: number | null };
  builds: { total: number; successRate: number | null; avgDuration: number | null };
  requests: { total: number; errorRate: number | null; avgDuration: number | null };
  topSourcesByCpu: SourceSummary[];
  topSourcesByMemory: SourceSummary[];
}

export class MetricsQueryService {
  private builder: MetricsQueryBuilder;

  constructor(db: PrismaClient, logger: LoggerService) {
    this.builder = new MetricsQueryBuilder(db, logger);
  }

  async getTimeSeries(query: MetricsQuery): Promise<TimeSeriesResult[]> {
    const series = await this.builder.getTimeSeries(query);
    return series.map((s) => ({
      metric: s.metric,
      sourceType: s.sourceType,
      sourceId: s.sourceId,
      sourceName: s.sourceName,
      unit: s.unit ?? metricRegistry.get(s.metric)?.unit ?? null,
      labels: s.labels,
      points: s.points.map((p) => ({
        timestamp: p.timestamp,
        value: p.value,
        sampleCount: p.sampleCount,
      })),
    }));
  }

  async getLatestValues(query: {
    sourceType?: SourceType;
    sourceId?: string;
    metric?: string;
    projectId?: string;
  }): Promise<LatestMetricValue[]> {
    return this.builder.getLatestValues(query);
  }

  async getSources(params: {
    metric?: string;
    sourceType?: string;
    projectId?: string;
  }): Promise<MetricSource[]> {
    return this.builder.getSources(params);
  }

  async getTopSources(params: {
    metric: string;
    lookback?: string;
    limit?: number;
  }): Promise<SourceSummary[]> {
    const lookbackMs = parseLookback(params.lookback ?? "1h");
    const now = new Date();
    const from = new Date(now.getTime() - lookbackMs);
    const results = await this.builder.getTopSources({
      metric: params.metric,
      aggregation: "avg",
      from,
      to: now,
      limit: params.limit ?? 5,
    });
    return results.map((r) => this.topSourceToSummary(r, params.metric));
  }

  async getAggregate(
    query: MetricsQuery & { aggregation: AggregationFunction }
  ): Promise<{ value: number; aggregation: AggregationFunction }> {
    return this.builder.getAggregate(query);
  }

  async getSourceMetrics(
    sourceType: SourceType,
    sourceId: string,
    params: { from: Date; to: Date; interval?: TimeBucketInterval }
  ): Promise<TimeSeriesResult[]> {
    const knownMetrics = this.getMetricsForSourceType(sourceType);
    const results: TimeSeriesResult[] = [];

    for (const metric of knownMetrics) {
      const series = await this.builder.getTimeSeries({
        sourceType,
        sourceId,
        metric,
        from: params.from,
        to: params.to,
        interval: params.interval,
        aggregation: "avg",
      });
      results.push(
        ...series.map((s) => ({
          metric: s.metric,
          sourceType: s.sourceType,
          sourceId: s.sourceId,
          sourceName: s.sourceName,
          unit: s.unit ?? metricRegistry.get(s.metric)?.unit ?? null,
          labels: s.labels,
          points: s.points.map((p) => ({
            timestamp: p.timestamp,
            value: p.value,
            sampleCount: p.sampleCount,
          })),
        }))
      );
    }

    return results;
  }

  async getPlatformSummary(lookback?: string): Promise<PlatformSummary> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      activeContainers,
      activeDeployments,
      buildTotal,
      buildErrors,
      buildDuration,
      requestTotal,
      requestErrors,
      requestDuration,
      topCpuSources,
      topMemorySources,
    ] = await Promise.all([
      this.builder.getLatestValues({ metric: "active_containers" }),
      this.builder.getLatestValues({ metric: "active_deployments" }),

      this.builder
        .getAggregate({
          metric: "build_total",
          from: twentyFourHoursAgo,
          to: now,
          aggregation: "sum",
        })
        .catch(() => ({ value: 0, aggregation: "sum" as const })),

      this.builder
        .getAggregate({
          metric: "build_errors_total",
          from: twentyFourHoursAgo,
          to: now,
          aggregation: "sum",
        })
        .catch(() => ({ value: 0, aggregation: "sum" as const })),

      this.builder
        .getAggregate({
          metric: "build_duration_seconds",
          from: twentyFourHoursAgo,
          to: now,
          aggregation: "avg",
        })
        .catch(() => ({ value: 0, aggregation: "avg" as const })),

      this.builder
        .getAggregate({
          metric: "http_requests_total",
          from: oneHourAgo,
          to: now,
          aggregation: "sum",
        })
        .catch(() => ({ value: 0, aggregation: "sum" as const })),

      this.builder
        .getAggregate({
          metric: "http_request_errors_total",
          from: oneHourAgo,
          to: now,
          aggregation: "sum",
        })
        .catch(() => ({ value: 0, aggregation: "sum" as const })),

      this.builder
        .getAggregate({
          metric: "http_request_duration_seconds",
          from: oneHourAgo,
          to: now,
          aggregation: "avg",
        })
        .catch(() => ({ value: 0, aggregation: "avg" as const })),

      this.getTopSources({ metric: "cpu_usage_percent", lookback }).catch(() => []),

      this.getTopSources({ metric: "memory_usage_percent", lookback }).catch(() => []),
    ]);

    const totalContainers = activeContainers.reduce((sum, v) => sum + v.value, 0);
    const totalActiveContainers = activeContainers.length;
    const totalDeployments = activeDeployments.reduce((sum, v) => sum + v.value, 0);
    const totalActiveDeployments = activeDeployments.length;

    const buildSuccessRate =
      buildTotal.value > 0
        ? ((buildTotal.value - buildErrors.value) / buildTotal.value) * 100
        : null;

    const errorRate =
      requestTotal.value > 0 ? (requestErrors.value / requestTotal.value) * 100 : null;

    return {
      containers: { total: totalContainers, active: totalActiveContainers },
      deployments: { total: totalDeployments, active: totalActiveDeployments, successRate: null },
      builds: {
        total: buildTotal.value,
        successRate: buildSuccessRate,
        avgDuration: buildDuration.value || null,
      },
      requests: {
        total: Math.round(requestTotal.value),
        errorRate,
        avgDuration: requestDuration.value || null,
      },
      topSourcesByCpu: topCpuSources,
      topSourcesByMemory: topMemorySources,
    };
  }

  private getMetricsForSourceType(sourceType: SourceType): string[] {
    switch (sourceType) {
      case "CONTAINER":
        return [
          "cpu_usage_percent",
          "memory_usage_bytes",
          "memory_usage_percent",
          "network_rx_bytes",
          "network_tx_bytes",
          "block_io_read_bytes",
          "block_io_write_bytes",
          "health_status",
        ];
      case "SERVICE":
        return ["cpu_usage_percent", "memory_usage_bytes", "memory_usage_percent", "health_status"];
      case "BUILD":
        return ["build_duration_seconds", "build_total", "build_errors_total"];
      case "DEPLOYMENT":
        return ["deployment_duration_seconds"];
      case "SYSTEM":
        return ["active_containers", "active_deployments", "queue_depth", "queue_throughput"];
      default:
        return [];
    }
  }

  private topSourceToSummary(r: TopSourceResult, metric: string): SourceSummary {
    return {
      sourceType: r.sourceType as SourceType,
      sourceId: r.sourceId,
      sourceName: r.sourceName,
      projectId: null,
      metrics: [
        {
          metric,
          value: r.value,
          unit: metricRegistry.get(metric)?.unit ?? "unknown",
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }
}
