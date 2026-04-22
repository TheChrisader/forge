import type { SourceType } from "@forge/database";

// ─── Sentinel UUIDs for synthetic sources ──────────────────────────
// These are stable, non-entity UUIDs used when no real entity ID applies.
// Generated once and hardcoded so queries remain consistent across restarts.

export const METRIC_SOURCE_IDS = {
  /** Represents the API server itself (HTTP metrics, request counters) */
  api: "00000000-0000-0000-0000-000000000001" as const,
  /** Represents the platform as a whole (aggregate counts, queue stats) */
  platform: "00000000-0000-0000-0000-000000000002" as const,
  /** Fallback when a real entity ID is unavailable */
  unknown: "00000000-0000-0000-0000-000000000003" as const,
} as const;

// ─── Metric Point (query result) ───────────────────────────────────

export interface MetricPoint {
  timestamp: string;
  value: number;
  sampleCount?: number;
}

export interface MetricSeries {
  metric: string;
  sourceType: SourceType;
  sourceId: string;
  sourceName: string;
  unit: string | null;
  labels: Record<string, string> | null;
  points: MetricPoint[];
}

// ─── Collector Types ────────────────────────────────────────────────

export interface MetricRecord {
  sourceType: SourceType;
  sourceId: string;
  sourceName: string;
  metric: string;
  value: number;
  unit?: string;
  labels?: Record<string, string>;
  projectId?: string;
  containerId?: string;
  serviceId?: string;
  deploymentId?: string;
}

export interface CollectorConfig {
  /** Maximum records to buffer before flushing (default: 500) */
  maxBatchSize: number;
  /** Maximum milliseconds between flushes (default: 5000) */
  flushIntervalMs: number;
  /** Whether the collector is enabled (default: true) */
  enabled: boolean;
}

// ─── Query Types ────────────────────────────────────────────────────

export type AggregationFunction = "avg" | "sum" | "min" | "max" | "count" | "p50" | "p95" | "p99";

export type TimeBucketInterval = "1m" | "5m" | "15m" | "1h" | "6h" | "1d";

export interface MetricsQuery {
  sourceType?: SourceType;
  sourceId?: string;
  metric?: string;
  from: Date;
  to: Date;
  interval?: TimeBucketInterval;
  aggregation?: AggregationFunction;
  projectId?: string;
}

export interface LatestMetricQuery {
  sourceType?: SourceType;
  sourceId?: string;
  metric?: string;
  projectId?: string;
}

// ─── Registry Types ─────────────────────────────────────────────────

export type MetricType = "gauge" | "counter" | "histogram";

export interface MetricDefinition {
  /** Unique metric name (e.g., "cpu_usage_percent") */
  name: string;
  /** Human-readable description */
  description: string;
  /** Type of metric */
  type: MetricType;
  /** Unit of measurement */
  unit: string;
  /** Category for grouping */
  category: "infrastructure" | "application" | "platform";
}

// ─── Callback Types ─────────────────────────────────────────────────

export type FlushCallback = (records: MetricRecord[]) => void | Promise<void>;
