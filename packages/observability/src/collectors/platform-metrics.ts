import type { PrismaClient } from "@forge/database";
import type { MetricsCollector } from "../collector";
import { METRIC_SOURCE_IDS } from "../types";
import type { MetricRecord } from "../types";

export interface PlatformMetricsConfig {
  intervalMs?: number;
}

export interface QueueMetricsProvider {
  getAllMetrics(): Array<{
    queueName: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    throughput?: number;
  }>;
}

export class PlatformMetricsCollector {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly db: PrismaClient,
    private readonly collector: MetricsCollector,
    private readonly queueMetricsProvider?: QueueMetricsProvider,
    private readonly config?: PlatformMetricsConfig
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    const interval = this.config?.intervalMs ?? 60_000;
    void this.collect();
    this.timer = setInterval(() => void this.collect(), interval);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async collect(): Promise<void> {
    if (!this.running) return;

    try {
      const records: MetricRecord[] = [
        ...(await this.collectContainerCounts()),
        ...(await this.collectDeploymentCounts()),
        ...this.collectQueueMetrics(),
      ];

      if (records.length > 0) {
        this.collector.recordMany(records);
      }
    } catch {
      // Don't let collection errors crash the timer loop.
      // Errors are already logged by MetricsCollector if flush fails.
    }
  }

  private async collectContainerCounts(): Promise<MetricRecord[]> {
    const rows = await this.db.container.groupBy({
      by: ["projectId"],
      where: { status: "RUNNING" },
      _count: { _all: true },
    });

    const records: MetricRecord[] = [];

    let total = 0;
    for (const row of rows) {
      const count = row._count._all;
      total += count;
      records.push({
        sourceType: "SYSTEM",
        sourceId: row.projectId ?? METRIC_SOURCE_IDS.unknown,
        sourceName: "Forge Platform",
        metric: "active_containers",
        value: count,
        unit: "count",
        projectId: row.projectId ?? undefined,
      });
    }

    records.push({
      sourceType: "SYSTEM",
      sourceId: METRIC_SOURCE_IDS.platform,
      sourceName: "Forge Platform",
      metric: "active_containers",
      value: total,
      unit: "count",
    });

    return records;
  }

  private async collectDeploymentCounts(): Promise<MetricRecord[]> {
    const rows = await this.db.deployment.groupBy({
      by: ["projectId"],
      where: { status: "RUNNING" },
      _count: { _all: true },
    });

    const records: MetricRecord[] = [];

    let total = 0;
    for (const row of rows) {
      const count = row._count._all;
      total += count;
      records.push({
        sourceType: "SYSTEM",
        sourceId: row.projectId ?? METRIC_SOURCE_IDS.unknown,
        sourceName: "Forge Platform",
        metric: "active_deployments",
        value: count,
        unit: "count",
        projectId: row.projectId ?? undefined,
      });
    }

    records.push({
      sourceType: "SYSTEM",
      sourceId: METRIC_SOURCE_IDS.platform,
      sourceName: "Forge Platform",
      metric: "active_deployments",
      value: total,
      unit: "count",
    });

    return records;
  }

  private collectQueueMetrics(): MetricRecord[] {
    if (!this.queueMetricsProvider) return [];

    const metrics = this.queueMetricsProvider.getAllMetrics();
    const records: MetricRecord[] = [];

    for (const m of metrics) {
      records.push(
        {
          sourceType: "SYSTEM",
          sourceId: METRIC_SOURCE_IDS.platform,
          sourceName: "Forge Platform",
          metric: "queue_depth",
          value: m.waiting,
          unit: "count",
          labels: { queue: m.queueName },
        },
        {
          sourceType: "SYSTEM",
          sourceId: METRIC_SOURCE_IDS.platform,
          sourceName: "Forge Platform",
          metric: "queue_throughput",
          value: m.throughput ?? 0,
          unit: "count/sec",
          labels: { queue: m.queueName },
        }
      );
    }

    return records;
  }
}
