import type { PrismaClient } from "@forge/database";
import type { LoggerService } from "@forge/logger";
import { metricRegistry } from "../registry.js";
import { escapeLabelValue } from "./exposition.js";

export interface DbMetricSample {
  metric: string;
  value: number;
  timestamp: Date;
  sourceType: string;
  sourceId: string;
  sourceName: string;
  projectId: string | null;
  promType: "gauge" | "counter";
}

const EXCLUDED_METRICS = new Set(["build_total", "build_errors_total"]);

function getQueryableMetricNames(): string[] {
  const infra = metricRegistry.getByCategory("infrastructure");
  const platform = metricRegistry.getByCategory("platform");
  return [...infra, ...platform].map((d) => d.name).filter((name) => !EXCLUDED_METRICS.has(name));
}

let cachedMetricNames: string[] | null = null;

function getMetricNames(): string[] {
  if (!cachedMetricNames) {
    cachedMetricNames = getQueryableMetricNames();
  }
  return cachedMetricNames;
}

export class PrometheusDbProvider {
  private readonly db: PrismaClient;
  private readonly logger: LoggerService;

  constructor(db: PrismaClient, logger: LoggerService) {
    this.db = db;
    this.logger = logger;
  }

  async getLatestMetricSamples(): Promise<DbMetricSample[]> {
    const names = getMetricNames();
    if (names.length === 0) return [];

    try {
      const rows = await this.db.$queryRawUnsafe<
        Array<{
          metric: string;
          value: number;
          timestamp: Date;
          source_type: string;
          source_id: string;
          source_name: string;
          project_id: string | null;
        }>
      >(
        `SELECT DISTINCT ON (metric, source_id)
          metric, value, timestamp, source_type, source_id, source_name, project_id
        FROM metrics
        WHERE metric IN (${names.map((_, i) => `$${i + 1}`).join(",")})
        ORDER BY metric, source_id, timestamp DESC`,
        ...names
      );

      return rows.map((row) => {
        const def = metricRegistry.get(row.metric);
        return {
          metric: row.metric,
          value: row.value,
          timestamp: row.timestamp,
          sourceType: row.source_type,
          sourceId: row.source_id,
          sourceName: row.source_name,
          projectId: row.project_id,
          promType: mapToPromType(def?.type),
        };
      });
    } catch (error) {
      this.logger.error("Failed to query metrics for Prometheus exposition", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async getLatestMetricSamplesForProject(projectId: string): Promise<DbMetricSample[]> {
    const names = getMetricNames();
    if (names.length === 0) return [];

    try {
      const rows = await this.db.$queryRawUnsafe<
        Array<{
          metric: string;
          value: number;
          timestamp: Date;
          source_type: string;
          source_id: string;
          source_name: string;
          project_id: string | null;
        }>
      >(
        `SELECT DISTINCT ON (metric, source_id)
          metric, value, timestamp, source_type, source_id, source_name, project_id
        FROM metrics
        WHERE metric IN (${names.map((_, i) => `$${i + 1}`).join(",")})
          AND project_id = $${names.length + 1}::uuid
        ORDER BY metric, source_id, timestamp DESC`,
        ...names,
        projectId
      );

      return rows.map((row) => {
        const def = metricRegistry.get(row.metric);
        return {
          metric: row.metric,
          value: row.value,
          timestamp: row.timestamp,
          sourceType: row.source_type,
          sourceId: row.source_id,
          sourceName: row.source_name,
          projectId: row.project_id,
          promType: mapToPromType(def?.type),
        };
      });
    } catch (error) {
      this.logger.error("Failed to query project metrics for Prometheus exposition", {
        error: error instanceof Error ? error.message : String(error),
        projectId,
      });
      return [];
    }
  }

  renderSamples(samples: DbMetricSample[]): string {
    if (samples.length === 0) return "";

    const grouped = new Map<
      string,
      { help: string; promType: "gauge" | "counter"; entries: DbMetricSample[] }
    >();

    for (const sample of samples) {
      const promName = `forge_${sample.metric}`;
      let group = grouped.get(promName);
      if (!group) {
        const def = metricRegistry.get(sample.metric);
        group = {
          help: def?.description ?? sample.metric,
          promType: sample.promType,
          entries: [],
        };
        grouped.set(promName, group);
      }
      group.entries.push(sample);
    }

    const lines: string[] = [];

    for (const [promName, group] of grouped) {
      lines.push(`# HELP ${promName} ${group.help}`);
      lines.push(`# TYPE ${promName} ${group.promType}`);

      for (const sample of group.entries) {
        const projectId = sample.projectId ?? "";
        const labelStr = `source_type="${escapeLabelValue(sample.sourceType)}",source_id="${escapeLabelValue(sample.sourceId)}",source_name="${escapeLabelValue(sample.sourceName)}",project_id="${escapeLabelValue(projectId)}"`;
        lines.push(`${promName}{${labelStr}} ${sample.value}`);
      }
    }

    return lines.join("\n") + "\n";
  }
}

function mapToPromType(metricType: string | undefined): "gauge" | "counter" {
  if (metricType === "counter") return "counter";
  return "gauge";
}
