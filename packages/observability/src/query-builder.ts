import type { PrismaClient } from "@forge/database";
import type { ILogger } from "@forge/logger";
import type { LoggerService } from "@forge/logger";
import type {
  MetricsQuery,
  MetricSeries,
  MetricPoint,
  LatestMetricQuery,
  AggregationFunction,
} from "./types";
import {
  selectAggregateTable,
  toTimescaleInterval,
  aggregationSql,
  buildTimeSeriesQuery,
  buildLatestValueQuery,
  buildSourcesQuery,
  buildTopSourcesQuery,
} from "./timescale-helpers";

export interface MetricSource {
  sourceId: string;
  sourceType: string;
  sourceName: string;
}

export interface LatestMetricValue {
  metric: string;
  value: number;
  timestamp: Date;
  sourceType: string;
  sourceId: string;
  sourceName: string;
  unit: string | null;
}

export interface TopSourceResult {
  sourceId: string;
  sourceType: string;
  sourceName: string;
  value: number;
}

export class MetricsQueryBuilder {
  private readonly db: PrismaClient;
  private readonly logger: ILogger;

  constructor(db: PrismaClient, logger: LoggerService) {
    this.db = db;
    this.logger = logger.child({ component: "MetricsQueryBuilder" });
  }

  // ─── Time Series ────────────────────────────────────────────────

  async getTimeSeries(query: MetricsQuery): Promise<MetricSeries[]> {
    const { from, to, metric, sourceType, sourceId, projectId, interval, aggregation } = query;

    if (!metric) {
      throw new Error("metric name is required for time series queries");
    }

    const table = selectAggregateTable(from, to, interval);
    const intervalStr = interval ? toTimescaleInterval(interval) : undefined;
    const agg = aggregation || "avg";
    // For percentile queries, force raw table
    const effectiveTable = isPercentile(agg) ? "metrics" : table;
    const aggExpr = aggregationSql(agg, effectiveTable);

    this.logger.debug("Executing time series query", { metric, table: effectiveTable, from, to });

    let rows: Array<{ bucket: Date; value: number; sample_count: number }>;

    try {
      const { sql, args } = buildTimeSeriesQuery({
        table: effectiveTable,
        metric,
        from,
        to,
        interval: intervalStr,
        aggregation: aggExpr,
        sourceType,
        sourceId,
        projectId,
      });

      rows = await this.db.$queryRawUnsafe<
        Array<{ bucket: Date; value: number; sample_count: number }>
      >(sql, ...args);
    } catch (error) {
      if (effectiveTable !== "metrics" && isColumnNotFoundError(error)) {
        this.logger.debug("Aggregate table unavailable, falling back to raw metrics", {
          originalTable: effectiveTable,
        });
        const rawAggExpr = aggregationSql(agg, "metrics");
        const { sql, args } = buildTimeSeriesQuery({
          table: "metrics",
          metric,
          from,
          to,
          interval: intervalStr,
          aggregation: rawAggExpr,
          sourceType,
          sourceId,
          projectId,
        });
        rows = await this.db.$queryRawUnsafe<
          Array<{ bucket: Date; value: number; sample_count: number }>
        >(sql, ...args);
      } else {
        throw error;
      }
    }

    const points: MetricPoint[] = rows.map((row) => ({
      timestamp: new Date(row.bucket).toISOString(),
      value: Number(row.value),
      sampleCount: Number(row.sample_count ?? 0),
    }));

    // Fetch metadata for the series (source name, unit)
    const metaRow = await this.db.metric.findFirst({
      where: { metric, ...(sourceId ? { sourceId } : {}), ...(sourceType ? { sourceType } : {}) },
      select: { sourceName: true, unit: true, sourceType: true, sourceId: true, labels: true },
      orderBy: { timestamp: "desc" },
    });

    return [
      {
        metric,
        sourceType: metaRow?.sourceType ?? sourceType ?? "SYSTEM",
        sourceId: metaRow?.sourceId ?? sourceId ?? "",
        sourceName: metaRow?.sourceName ?? "",
        unit: metaRow?.unit ?? null,
        labels: (metaRow?.labels as Record<string, string> | null) ?? null,
        points,
      },
    ];
  }

  // ─── Latest Values ──────────────────────────────────────────────

  async getLatestValues(query: LatestMetricQuery): Promise<LatestMetricValue[]> {
    if (!query.metric) {
      throw new Error("metric name is required for latest value queries");
    }

    const { sql, args } = buildLatestValueQuery({
      metric: query.metric,
      sourceType: query.sourceType,
      sourceId: query.sourceId,
      projectId: query.projectId,
    });

    const rows = await this.db.$queryRawUnsafe<
      Array<{
        metric: string;
        value: number;
        timestamp: Date;
        source_type: string;
        source_id: string;
        source_name: string;
        unit: string | null;
      }>
    >(sql, ...args);

    return rows.map((row) => ({
      metric: row.metric,
      value: Number(row.value),
      timestamp: row.timestamp,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceName: row.source_name,
      unit: row.unit,
    }));
  }

  // ─── Sources ────────────────────────────────────────────────────

  async getSources(params: {
    metric?: string;
    sourceType?: string;
    projectId?: string;
  }): Promise<MetricSource[]> {
    const { sql, args } = buildSourcesQuery(params);

    const rows = await this.db.$queryRawUnsafe<
      Array<{ source_id: string; source_type: string; source_name: string }>
    >(sql, ...args);

    return rows.map((row) => ({
      sourceId: row.source_id,
      sourceType: row.source_type,
      sourceName: row.source_name,
    }));
  }

  // ─── Top Sources ────────────────────────────────────────────────

  async getTopSources(params: {
    metric: string;
    aggregation: AggregationFunction;
    from: Date;
    to: Date;
    sourceType?: string;
    projectId?: string;
    limit?: number;
  }): Promise<TopSourceResult[]> {
    const { sql, args } = buildTopSourcesQuery({
      metric: params.metric,
      aggregation: params.aggregation,
      from: params.from,
      to: params.to,
      sourceType: params.sourceType,
      projectId: params.projectId,
      limit: params.limit,
    });

    const rows = await this.db.$queryRawUnsafe<
      Array<{ source_id: string; source_type: string; source_name: string; value: number }>
    >(sql, ...args);

    return rows.map((row) => ({
      sourceId: row.source_id,
      sourceType: row.source_type,
      sourceName: row.source_name,
      value: Number(row.value),
    }));
  }

  // ─── Aggregate ──────────────────────────────────────────────────

  async getAggregate(
    query: MetricsQuery & { aggregation: AggregationFunction }
  ): Promise<{ value: number; aggregation: AggregationFunction }> {
    const { metric, from, to, aggregation, sourceType, sourceId, projectId } = query;

    if (!metric) {
      throw new Error("metric name is required for aggregate queries");
    }

    const table = selectAggregateTable(from, to);
    const effectiveTable = isPercentile(aggregation) ? "metrics" : table;
    const aggExpr = aggregationSql(aggregation, effectiveTable);

    const timeCol =
      effectiveTable === "metrics"
        ? "timestamp"
        : effectiveTable === "metrics_1min"
          ? "minute"
          : "hour";

    const args: (string | number | Date)[] = [];
    let paramIdx = 1;
    const nextParam = (value: string | number | Date): string => {
      args.push(value);
      return `$${paramIdx++}`;
    };

    let sql = `SELECT ${aggExpr} AS value FROM ${effectiveTable} WHERE metric = ${nextParam(metric)}`;

    if (sourceType) sql += ` AND source_type = ${nextParam(sourceType)}`;
    if (sourceId) sql += ` AND source_id = ${nextParam(sourceId)}::uuid`;
    if (projectId) sql += ` AND project_id = ${nextParam(projectId)}::uuid`;

    sql += ` AND ${timeCol} >= ${nextParam(from)} AND ${timeCol} <= ${nextParam(to)}`;

    try {
      const rows = await this.db.$queryRawUnsafe<Array<{ value: number | null }>>(sql, ...args);

      return {
        value: rows[0]?.value != null ? Number(rows[0].value) : 0,
        aggregation,
      };
    } catch (error) {
      if (effectiveTable !== "metrics" && isColumnNotFoundError(error)) {
        this.logger.debug("Aggregate table unavailable, falling back to raw metrics", {
          originalTable: effectiveTable,
        });
        const rawAggExpr = aggregationSql(aggregation, "metrics");
        const rawArgs: (string | number | Date)[] = [];
        let rawIdx = 1;
        const rawNext = (v: string | number | Date): string => {
          rawArgs.push(v);
          return `$${rawIdx++}`;
        };
        let rawSql = `SELECT ${rawAggExpr} AS value FROM metrics WHERE metric = ${rawNext(metric)}`;
        if (sourceType) rawSql += ` AND source_type = ${rawNext(sourceType)}`;
        if (sourceId) rawSql += ` AND source_id = ${rawNext(sourceId)}::uuid`;
        if (projectId) rawSql += ` AND project_id = ${rawNext(projectId)}::uuid`;
        rawSql += ` AND timestamp >= ${rawNext(from)} AND timestamp <= ${rawNext(to)}`;
        const rows = await this.db.$queryRawUnsafe<Array<{ value: number | null }>>(
          rawSql,
          ...rawArgs
        );
        return { value: rows[0]?.value != null ? Number(rows[0].value) : 0, aggregation };
      }
      throw error;
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

function isPercentile(agg: AggregationFunction): boolean {
  return agg === "p50" || agg === "p95" || agg === "p99";
}

function isColumnNotFoundError(error: unknown): boolean {
  if (error && typeof error === "object" && "meta" in error) {
    const meta = (error as { meta?: { driverAdapterError?: { cause?: { kind?: string } } } }).meta;
    return meta?.driverAdapterError?.cause?.kind === "ColumnNotFound";
  }
  return false;
}
