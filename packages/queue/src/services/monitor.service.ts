/**
 * Queue Monitor Service
 */

import type { QueueService } from "./queue.service";

export interface QueueMetrics {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  isPaused: boolean;
  throughput?: {
    jobsPerSecond: number;
    avgProcessingTime: number;
  };
}

/**
 * Queue Monitor
 */
export class QueueMonitor {
  private metrics = new Map<string, QueueMetrics>();
  private lastCheck = new Map<string, { completed: number; timestamp: number }>();

  constructor(private queueService: QueueService) {}

  /**
   * Collect metrics for a specific queue
   */
  async collectMetrics(queueName: string): Promise<QueueMetrics> {
    const health = await this.queueService.getHealth(queueName);

    let throughput;
    const now = Date.now();
    const last = this.lastCheck.get(queueName);

    if (last) {
      const timeDiff = (now - last.timestamp) / 1000;
      const jobsDiff = health.counts.completed - last.completed;
      const jobsPerSecond = jobsDiff / timeDiff;

      throughput = {
        jobsPerSecond,
        avgProcessingTime: jobsPerSecond > 0 ? 1000 / jobsPerSecond : 0,
      };
    }

    this.lastCheck.set(queueName, {
      completed: health.counts.completed,
      timestamp: now,
    });

    const metrics: QueueMetrics = {
      queueName,
      ...health.counts,
      isPaused: health.isPaused,
      throughput,
    };

    this.metrics.set(queueName, metrics);

    return metrics;
  }

  /**
   * Get cached metrics for a queue
   */
  getMetrics(queueName: string): QueueMetrics | undefined {
    return this.metrics.get(queueName);
  }

  /**
   * Get all cached metrics
   */
  getAllMetrics(): QueueMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Check if a queue is healthy
   */
  isHealthy(queueName: string): boolean {
    const metrics = this.metrics.get(queueName);
    if (!metrics) return false;

    const maxFailed = 1000;
    const maxWaiting = 10000;

    return metrics.failed < maxFailed && !metrics.isPaused && metrics.waiting < maxWaiting;
  }

  /**
   * Get alerts for a queue
   */
  getAlerts(queueName: string): string[] {
    const alerts: string[] = [];
    const metrics = this.metrics.get(queueName);

    if (!metrics) {
      alerts.push("No metrics available");
      return alerts;
    }

    if (metrics.failed > 100) {
      alerts.push(`High failure rate: ${metrics.failed} failed jobs`);
    }

    if (metrics.isPaused) {
      alerts.push("Queue is paused");
    }

    if (metrics.waiting > 1000) {
      alerts.push(`Large backlog: ${metrics.waiting} waiting jobs`);
    }

    if (metrics.throughput && metrics.throughput.jobsPerSecond < 0.1) {
      alerts.push("Low throughput detected");
    }

    return alerts;
  }

  /**
   * Clear all cached metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
    this.lastCheck.clear();
  }
}
