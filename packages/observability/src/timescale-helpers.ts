import type { AggregationFunction, TimeBucketInterval } from "./types";

// ─── Interval Mapping ──────────────────────────────────────────────

const INTERVAL_MAP: Record<TimeBucketInterval, string> = {
  "1m": "'1 minute'",
  "5m": "'5 minutes'",
  "15m": "'15 minutes'",
  "1h": "'1 hour'",
  "6h": "'6 hours'",
  "1d": "'1 day'",
};

export function toTimescaleInterval(interval: TimeBucketInterval): string {
  return INTERVAL_MAP[interval];
}

// ─── Aggregate Target Selection ─────────────────────────────────────

/**
 * Determines which table to query based on the time range.
 * - Recent data (< 5 minutes): raw `metrics` table
 * - Historical data: `metrics_1min` continuous aggregate
 * - Long ranges (> 24h with hourly+ interval): `metrics_hourly`
 */
export function selectAggregateTable(from: Date, to: Date, interval?: TimeBucketInterval): string {
  const rangeMs = to.getTime() - from.getTime();
  const fiveMinutes = 5 * 60 * 1000;
  const oneDay = 24 * 60 * 60 * 1000;

  if (rangeMs <= fiveMinutes) {
    return "metrics";
  }

  if (rangeMs > oneDay && (interval === "1h" || interval === "6h" || interval === "1d")) {
    return "metrics_hourly";
  }

  return "metrics_1min";
}

// ─── Aggregation SQL ────────────────────────────────────────────────

/**
 * Returns the SQL expression for the requested aggregation function.
 * For continuous aggregates, maps to pre-computed columns.
 * For percentile queries, falls back to raw table with percentile_cont.
 */
export function aggregationSql(agg: AggregationFunction, table: string): string {
  if (table === "metrics_1min" || table === "metrics_hourly") {
    // Continuous aggregate rows are grouped by (bucket, source_id, source_type, metric).
    // A query that GROUP BYs only on bucket (e.g., across sources) must wrap the
    // pre-computed columns in aggregate functions, otherwise PostgreSQL rejects the
    // query (42803: column must appear in GROUP BY or be used in an aggregate).
    switch (agg) {
      case "avg":
        return "AVG(avg_value)";
      case "max":
        return "MAX(max_value)";
      case "min":
        return "MIN(min_value)";
      case "count":
        return "SUM(sample_count)";
      default:
        // Percentiles require raw data — callers should force the raw table
        return "AVG(avg_value)";
    }
  }

  // Raw metrics table
  switch (agg) {
    case "avg":
      return "AVG(value)";
    case "sum":
      return "SUM(value)";
    case "min":
      return "MIN(value)";
    case "max":
      return "MAX(value)";
    case "count":
      return "COUNT(*)";
    case "p50":
      return "percentile_cont(0.5) WITHIN GROUP (ORDER BY value)";
    case "p95":
      return "percentile_cont(0.95) WITHIN GROUP (ORDER BY value)";
    case "p99":
      return "percentile_cont(0.99) WITHIN GROUP (ORDER BY value)";
  }
}

// ─── Query Builders ─────────────────────────────────────────────────

export interface TimeSeriesQueryParams {
  table: string;
  metric: string;
  from: Date;
  to: Date;
  interval?: string;
  aggregation?: string;
  sourceType?: string;
  sourceId?: string;
  projectId?: string;
}

/**
 * Build a time-series query with time_bucket aggregation.
 * Returns the SQL and parameters for Prisma $queryRaw.
 */
export function buildTimeSeriesQuery(params: TimeSeriesQueryParams): {
  sql: string;
  args: (string | number | Date)[];
} {
  const { table, metric, from, to, sourceType, sourceId, projectId } = params;
  const args: (string | number | Date)[] = [];
  let paramIdx = 1;

  const nextParam = (value: string | number | Date): string => {
    args.push(value);
    return `$${paramIdx++}`;
  };

  // Determine time column and bucket expression
  const timeCol = table === "metrics" ? "timestamp" : table === "metrics_1min" ? "minute" : "hour";
  const intervalStr = params.interval ? `INTERVAL ${params.interval}` : `INTERVAL '1 minute'`;

  const bucketExpr = table === "metrics" ? `time_bucket(${intervalStr}, ${timeCol})` : timeCol;

  const aggExpr = params.aggregation || "AVG(value)";

  let sql = `SELECT ${bucketExpr} AS bucket, ${aggExpr} AS value`;

  if (table === "metrics") {
    sql += `, COUNT(*) AS sample_count`;
  } else if (table === "metrics_1min") {
    sql += `, SUM(sample_count) AS sample_count`;
  }

  sql += ` FROM ${table}`;
  sql += ` WHERE metric = ${nextParam(metric)}`;

  if (sourceType) {
    sql += ` AND source_type = ${nextParam(sourceType)}`;
  }
  if (sourceId) {
    sql += ` AND source_id = ${nextParam(sourceId)}::uuid`;
  }
  if (projectId) {
    sql += ` AND project_id = ${nextParam(projectId)}::uuid`;
  }

  sql += ` AND ${timeCol} >= ${nextParam(from)}`;
  sql += ` AND ${timeCol} <= ${nextParam(to)}`;

  sql += ` GROUP BY bucket ORDER BY bucket ASC`;

  return { sql, args };
}

/**
 * Build a query for the latest value of a metric.
 */
export function buildLatestValueQuery(params: {
  metric: string;
  sourceType?: string;
  sourceId?: string;
  projectId?: string;
}): {
  sql: string;
  args: (string | number | Date)[];
} {
  const { metric, sourceType, sourceId, projectId } = params;
  const args: (string | number | Date)[] = [];
  let paramIdx = 1;

  const nextParam = (value: string | number | Date): string => {
    args.push(value);
    return `$${paramIdx++}`;
  };

  // DISTINCT ON returns the latest row per source_id.
  // When sourceId is specified the filter already narrows to one source,
  // so the result is still at most one row — no caller breakage.
  let sql = `
    SELECT DISTINCT ON (source_id) metric, value, timestamp, source_type, source_id, source_name, unit
    FROM metrics
    WHERE metric = ${nextParam(metric)}`;

  if (sourceType) {
    sql += ` AND source_type = ${nextParam(sourceType)}`;
  }
  if (sourceId) {
    sql += ` AND source_id = ${nextParam(sourceId)}::uuid`;
  }
  if (projectId) {
    sql += ` AND project_id = ${nextParam(projectId)}::uuid`;
  }

  sql += ` ORDER BY source_id, timestamp DESC`;

  return { sql, args };
}

/**
 * Build a query for top sources by aggregated metric value over a time window.
 * Groups by source, orders by value descending, limits results.
 */
export function buildTopSourcesQuery(params: {
  metric: string;
  aggregation: AggregationFunction;
  from: Date;
  to: Date;
  sourceType?: string;
  projectId?: string;
  limit?: number;
}): {
  sql: string;
  args: (string | number | Date)[];
} {
  const { metric, aggregation, from, to, sourceType, projectId, limit = 5 } = params;
  const args: (string | number | Date)[] = [];
  let paramIdx = 1;

  const nextParam = (value: string | number | Date): string => {
    args.push(value);
    return `$${paramIdx++}`;
  };

  const aggExpr = aggregationSql(aggregation, "metrics");

  let sql = `SELECT source_id, source_type, source_name, ${aggExpr} AS value
    FROM metrics
    WHERE metric = ${nextParam(metric)}
    AND timestamp >= ${nextParam(from)}
    AND timestamp <= ${nextParam(to)}`;

  if (sourceType) sql += ` AND source_type = ${nextParam(sourceType)}`;
  if (projectId) sql += ` AND project_id = ${nextParam(projectId)}::uuid`;

  sql += ` GROUP BY source_id, source_type, source_name`;
  sql += ` ORDER BY value DESC`;
  sql += ` LIMIT ${nextParam(limit)}`;

  return { sql, args };
}

/**
 * Build a query listing distinct sources that have reported a given metric.
 */
export function buildSourcesQuery(params: {
  metric?: string;
  sourceType?: string;
  projectId?: string;
}): {
  sql: string;
  args: (string | number | Date)[];
} {
  const { metric, sourceType } = params;
  const args: (string | number | Date)[] = [];
  let paramIdx = 1;

  const nextParam = (value: string | number | Date): string => {
    args.push(value);
    return `$${paramIdx++}`;
  };

  let sql = `
    SELECT DISTINCT source_id, source_type, source_name
    FROM metrics
    WHERE timestamp > NOW() - INTERVAL '1 hour'`;

  if (metric) {
    sql += ` AND metric = ${nextParam(metric)}`;
  }
  if (sourceType) {
    sql += ` AND source_type = ${nextParam(sourceType)}`;
  }
  if (params.projectId) {
    sql += ` AND project_id = ${nextParam(params.projectId)}::uuid`;
  }

  sql += ` ORDER BY source_name LIMIT 100`;

  return { sql, args };
}
