import { QueueMonitor, QUEUE_NAMES, getQueueService } from "@forge/queue";
import type { QueueConfig } from "@forge/queue";
import type { QueueMetricsProvider } from "@forge/observability";
import { LoggerService, LogLevel } from "@forge/logger";

const DEFAULT_COLLECTION_INTERVAL_MS = 30_000;

export class QueueMetricsAdapter implements QueueMetricsProvider {
  private monitor: QueueMonitor;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private logger: LoggerService;

  constructor(config: QueueConfig) {
    const queueService = getQueueService(config);
    this.monitor = new QueueMonitor(queueService);
    this.logger = new LoggerService({
      level: (process.env.LOG_LEVEL as LogLevel) ?? "INFO",
      format: process.env.NODE_ENV === "development" ? "pretty" : "json",
      enabled: true,
      name: "queue-metrics-adapter",
    });
  }

  start(intervalMs = DEFAULT_COLLECTION_INTERVAL_MS): void {
    if (this.running) return;
    this.running = true;

    for (const name of Object.values(QUEUE_NAMES)) {
      void this.collect(name);
    }

    this.timer = setInterval(() => {
      for (const name of Object.values(QUEUE_NAMES)) {
        void this.collect(name);
      }
    }, intervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getAllMetrics(): Array<{
    queueName: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    throughput?: number;
  }> {
    return this.monitor.getAllMetrics().map((m) => ({
      queueName: m.queueName,
      waiting: m.waiting,
      active: m.active,
      completed: m.completed,
      failed: m.failed,
      throughput: m.throughput?.jobsPerSecond,
    }));
  }

  private async collect(queueName: string): Promise<void> {
    if (!this.running) return;
    try {
      await this.monitor.collectMetrics(queueName);
    } catch (error) {
      this.logger.error("Failed to collect queue metrics", { queueName, error });
    }
  }
}
