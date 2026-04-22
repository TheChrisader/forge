/** Interval values matching the API's supported intervals */
export type TimeInterval = "1m" | "5m" | "15m" | "1h" | "6h" | "1d";

/** Aggregation functions matching the API */
export type Aggregation = "avg" | "sum" | "min" | "max" | "count" | "p50" | "p95" | "p99";

/** A single data point in a time series */
export interface ChartDataPoint {
  timestamp: string;
  [key: string]: string | number;
}

/** Series definition for multi-series charts */
export interface ChartSeries {
  dataKey: string;
  name: string;
  color: string;
  strokeDasharray?: string;
}

/** Time range selection */
export interface TimeRange {
  from: Date;
  to: Date;
  interval: TimeInterval;
  label: string;
}

/** Time range preset configuration */
export interface TimeRangePreset {
  label: string;
  durationMs: number;
  interval: TimeInterval;
}

/** Metric source type matching the Prisma enum */
export type SourceType = "CONTAINER" | "SERVICE" | "SYSTEM" | "BUILD" | "DEPLOYMENT";
