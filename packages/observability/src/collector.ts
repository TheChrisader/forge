import type { PrismaClient } from "@forge/database";
import type { ILogger } from "@forge/logger";
import type { LoggerService } from "@forge/logger";
import type { MetricRecord, CollectorConfig, FlushCallback } from "./types";

const DEFAULT_CONFIG: CollectorConfig = {
  maxBatchSize: 500,
  flushIntervalMs: 5000,
  enabled: true,
};

export class MetricsCollector {
  private readonly buffer: MetricRecord[] = [];
  private readonly config: CollectorConfig;
  private readonly db: PrismaClient;
  private readonly logger: ILogger;
  private readonly flushCallbacks: FlushCallback[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  constructor(db: PrismaClient, logger: LoggerService, config?: Partial<CollectorConfig>) {
    this.db = db;
    this.logger = logger.child({ component: "MetricsCollector" });
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => void this.flush(), this.config.flushIntervalMs);
    this.logger.info("Metrics collector started", {
      flushIntervalMs: this.config.flushIntervalMs,
      maxBatchSize: this.config.maxBatchSize,
    });
  }

  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
    this.logger.info("Metrics collector stopped");
  }

  record(record: MetricRecord): void {
    if (!this.config.enabled) return;
    this.buffer.push(record);
    if (this.buffer.length >= this.config.maxBatchSize) {
      void this.flush();
    }
  }

  recordMany(records: MetricRecord[]): void {
    if (!this.config.enabled) return;
    this.buffer.push(...records);
    if (this.buffer.length >= this.config.maxBatchSize) {
      void this.flush();
    }
  }

  onFlush(callback: FlushCallback): void {
    this.flushCallbacks.push(callback);
  }

  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;

    this.flushing = true;
    const records = this.buffer.splice(0, this.buffer.length);

    try {
      await this.writeBatch(records);
      await this.invokeFlushCallbacks(records);
      this.logger.debug("Flushed metrics batch", { count: records.length });
    } catch (error) {
      this.logger.error("Failed to flush metrics batch", {
        count: records.length,
        error: error instanceof Error ? error.message : String(error),
      });
      // Records are discarded on failure to prevent unbounded buffer growth.
      // Metrics are continuous, high-volume data — the next collection cycle
      // will produce fresh readings.
    } finally {
      this.flushing = false;
    }
  }

  private async writeBatch(records: MetricRecord[]): Promise<void> {
    const data = records.map((r) => ({
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      sourceName: r.sourceName,
      metric: r.metric,
      value: r.value,
      unit: r.unit ?? null,
      labels: r.labels ?? undefined,
      timestamp: new Date(),
      projectId: r.projectId ?? null,
      containerId: r.containerId ?? null,
      serviceId: r.serviceId ?? null,
      deploymentId: r.deploymentId ?? null,
    }));

    await this.db.metric.createMany({ data });
  }

  private async invokeFlushCallbacks(records: MetricRecord[]): Promise<void> {
    for (const cb of this.flushCallbacks) {
      try {
        await cb(records);
      } catch (error) {
        this.logger.error("Flush callback error", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
