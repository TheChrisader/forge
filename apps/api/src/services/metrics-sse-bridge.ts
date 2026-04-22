import type { MetricRecord } from "@forge/observability";
import type { ILogger } from "@forge/core";
import type { LoggerService } from "@forge/logger";
import type { SSEManagerService } from "./sse-manager.service.js";

export interface MetricSseEvent {
  sourceType: string;
  sourceId: string;
  sourceName: string;
  projectId: string | null;
  metrics: Array<{
    metric: string;
    value: number;
    timestamp: string;
    unit?: string;
    labels?: Record<string, string>;
  }>;
}

export class MetricsSseBridge {
  private readonly sseManager: SSEManagerService;
  private readonly logger: ILogger;

  constructor(sseManager: SSEManagerService, logger: LoggerService) {
    this.sseManager = sseManager;
    this.logger = logger.child({ component: "MetricsSseBridge" });
  }

  attach(collector: { onFlush(cb: (records: MetricRecord[]) => void): void }): void {
    collector.onFlush((records) => this.handleFlush(records));
  }

  handleFlush(records: MetricRecord[]): void {
    if (records.length === 0) return;

    try {
      const grouped = this.groupBySource(records);
      const timestamp = new Date().toISOString();

      for (const [sourceId, sourceRecords] of grouped) {
        const event = this.buildEvent(sourceRecords, timestamp);
        const topics = this.buildTopics(sourceRecords[0]);

        for (const topic of topics) {
          this.sseManager.publish(topic, {
            event: "metric.data",
            data: event,
            id: `metrics-${sourceId}-${Date.now()}`,
          });
        }
      }
    } catch (error) {
      this.logger.error("Failed to publish metric SSE events", { error });
    }
  }

  private groupBySource(records: MetricRecord[]): Map<string, MetricRecord[]> {
    const map = new Map<string, MetricRecord[]>();
    for (const record of records) {
      const existing = map.get(record.sourceId);
      if (existing) {
        existing.push(record);
      } else {
        map.set(record.sourceId, [record]);
      }
    }
    return map;
  }

  private buildEvent(records: MetricRecord[], timestamp: string): MetricSseEvent {
    const first = records[0];
    return {
      sourceType: first.sourceType,
      sourceId: first.sourceId,
      sourceName: first.sourceName,
      projectId: first.projectId ?? null,
      metrics: records.map((r) => ({
        metric: r.metric,
        value: r.value,
        timestamp,
        unit: r.unit,
        labels: r.labels,
      })),
    };
  }

  private buildTopics(sample: MetricRecord): string[] {
    const topics: string[] = [`metrics:source:${sample.sourceId}`];
    if (sample.projectId) {
      topics.push(`metrics:project:${sample.projectId}`);
    }
    topics.push("metrics:platform");
    return topics;
  }
}
