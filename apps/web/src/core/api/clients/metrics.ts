import { apiClient } from "../client";

export interface MetricsQueryParams {
  sourceType?: "CONTAINER" | "SERVICE" | "SYSTEM" | "BUILD" | "DEPLOYMENT";
  sourceId?: string;
  metric?: string;
  from: string;
  to: string;
  interval?: "1m" | "5m" | "15m" | "1h" | "6h" | "1d";
  aggregation?: "avg" | "sum" | "min" | "max" | "count" | "p50" | "p95" | "p99";
  projectId?: string;
}

export interface LatestQueryParams {
  sourceType?: string;
  sourceId?: string;
  metric?: string;
  projectId?: string;
}

export interface SourcesQueryParams {
  metric?: string;
  sourceType?: string;
  projectId?: string;
}

export interface SourceMetricsParams {
  from: string;
  to: string;
  interval?: string;
  projectId?: string;
}

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  sampleCount?: number;
}

export interface TimeSeriesResult {
  metric: string;
  sourceType: string;
  sourceId: string;
  sourceName: string;
  unit: string | null;
  labels: Record<string, string> | null;
  points: TimeSeriesPoint[];
}

export interface LatestMetricValue {
  metric: string;
  sourceType: string;
  sourceId: string;
  sourceName: string;
  value: number;
  unit: string | null;
  timestamp: string;
}

export interface MetricSource {
  sourceId: string;
  sourceType: string;
  sourceName: string;
}

export interface SourceMetricEntry {
  metric: string;
  value: number;
  unit: string;
  timestamp: string;
}

export interface SourceSummary {
  sourceType: string;
  sourceId: string;
  sourceName: string;
  projectId: string | null;
  metrics: SourceMetricEntry[];
}

export interface PlatformSummary {
  containers: { total: number; active: number };
  deployments: { total: number; active: number; successRate: number | null };
  builds: { total: number; successRate: number | null; avgDuration: number | null };
  requests: { total: number; errorRate: number | null; avgDuration: number | null };
  topSourcesByCpu: SourceSummary[];
  topSourcesByMemory: SourceSummary[];
}

type ParamsRecord = Record<string, string | number | boolean | string[]>;

function stripUndefined(params: object | undefined): ParamsRecord | undefined {
  if (!params) return undefined;
  const result: ParamsRecord = {};
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value !== undefined && value !== null) {
      result[key] = value as string | number | boolean | string[];
    }
  }
  return result;
}

export const metricsApi = {
  async query(params: MetricsQueryParams): Promise<TimeSeriesResult[]> {
    const res = await apiClient.get<{ data: TimeSeriesResult[] }>("/api/metrics/query", {
      params: stripUndefined(params),
    });
    return res.data;
  },

  async getSources(params?: SourcesQueryParams): Promise<MetricSource[]> {
    const res = await apiClient.get<{ data: MetricSource[] }>("/api/metrics/sources", {
      params: stripUndefined(params),
    });
    return res.data;
  },

  async getSourceMetrics(
    sourceType: string,
    sourceId: string,
    params: SourceMetricsParams
  ): Promise<TimeSeriesResult[]> {
    const res = await apiClient.get<{ data: TimeSeriesResult[] }>(
      `/api/metrics/${sourceType}/${sourceId}`,
      { params: stripUndefined(params) }
    );
    return res.data;
  },

  async getLatest(params?: LatestQueryParams): Promise<LatestMetricValue[]> {
    const res = await apiClient.get<{ data: LatestMetricValue[] }>("/api/metrics/latest", {
      params: stripUndefined(params),
    });
    return res.data;
  },

  async getSummary(): Promise<PlatformSummary> {
    const res = await apiClient.get<{ data: PlatformSummary }>("/api/metrics/summary");
    return res.data;
  },
};
