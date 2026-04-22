import type { MetricDefinition } from "./types";

class MetricRegistry {
  private readonly metrics = new Map<string, MetricDefinition>();

  register(definition: MetricDefinition): void {
    if (this.metrics.has(definition.name)) {
      throw new Error(`Metric "${definition.name}" is already registered`);
    }
    this.metrics.set(definition.name, definition);
  }

  get(name: string): MetricDefinition | undefined {
    return this.metrics.get(name);
  }

  getOrThrow(name: string): MetricDefinition {
    const def = this.metrics.get(name);
    if (!def) throw new Error(`Unknown metric: "${name}"`);
    return def;
  }

  getAll(): ReadonlyArray<MetricDefinition> {
    return Array.from(this.metrics.values());
  }

  getByCategory(category: MetricDefinition["category"]): ReadonlyArray<MetricDefinition> {
    return Array.from(this.metrics.values()).filter((m) => m.category === category);
  }

  has(name: string): boolean {
    return this.metrics.has(name);
  }
}

// ─── Global Registry Instance ───────────────────────────────────────

export const metricRegistry = new MetricRegistry();

// ─── Infrastructure Metrics ─────────────────────────────────────────

const INFRA_METRICS: MetricDefinition[] = [
  {
    name: "cpu_usage_percent",
    description: "CPU usage as a percentage of allocated limit",
    type: "gauge",
    unit: "percent",
    category: "infrastructure",
  },
  {
    name: "memory_usage_bytes",
    description: "Memory usage in bytes",
    type: "gauge",
    unit: "bytes",
    category: "infrastructure",
  },
  {
    name: "memory_usage_percent",
    description: "Memory usage as a percentage of allocated limit",
    type: "gauge",
    unit: "percent",
    category: "infrastructure",
  },
  {
    name: "network_rx_bytes",
    description: "Network bytes received (cumulative since container start)",
    type: "counter",
    unit: "bytes",
    category: "infrastructure",
  },
  {
    name: "network_tx_bytes",
    description: "Network bytes transmitted (cumulative since container start)",
    type: "counter",
    unit: "bytes",
    category: "infrastructure",
  },
  {
    name: "block_io_read_bytes",
    description: "Block I/O bytes read (cumulative since container start)",
    type: "counter",
    unit: "bytes",
    category: "infrastructure",
  },
  {
    name: "block_io_write_bytes",
    description: "Block I/O bytes written (cumulative since container start)",
    type: "counter",
    unit: "bytes",
    category: "infrastructure",
  },
  {
    name: "health_status",
    description: "Service health status (1 = healthy, 0 = unhealthy)",
    type: "gauge",
    unit: "status",
    category: "infrastructure",
  },
];

// ─── Application Metrics ────────────────────────────────────────────

const APP_METRICS: MetricDefinition[] = [
  {
    name: "http_request_duration_seconds",
    description: "HTTP request duration in seconds",
    type: "histogram",
    unit: "seconds",
    category: "application",
  },
  {
    name: "http_requests_total",
    description: "Total HTTP requests processed",
    type: "counter",
    unit: "count",
    category: "application",
  },
  {
    name: "http_request_errors_total",
    description: "Total HTTP requests resulting in 5xx errors",
    type: "counter",
    unit: "count",
    category: "application",
  },
];

// ─── Platform Metrics ───────────────────────────────────────────────

const PLATFORM_METRICS: MetricDefinition[] = [
  {
    name: "build_duration_seconds",
    description: "Build execution duration in seconds",
    type: "histogram",
    unit: "seconds",
    category: "platform",
  },
  {
    name: "build_total",
    description: "Total builds executed",
    type: "counter",
    unit: "count",
    category: "platform",
  },
  {
    name: "build_errors_total",
    description: "Total builds that failed",
    type: "counter",
    unit: "count",
    category: "platform",
  },
  {
    name: "deployment_duration_seconds",
    description: "Deployment execution duration in seconds",
    type: "histogram",
    unit: "seconds",
    category: "platform",
  },
  {
    name: "active_containers",
    description: "Number of currently running containers",
    type: "gauge",
    unit: "count",
    category: "platform",
  },
  {
    name: "active_deployments",
    description: "Number of currently active deployments",
    type: "gauge",
    unit: "count",
    category: "platform",
  },
  {
    name: "queue_depth",
    description: "Number of jobs waiting in the queue",
    type: "gauge",
    unit: "count",
    category: "platform",
  },
  {
    name: "queue_throughput",
    description: "Jobs processed per second",
    type: "gauge",
    unit: "count/sec",
    category: "platform",
  },
];

// Register all metrics
for (const def of [...INFRA_METRICS, ...APP_METRICS, ...PLATFORM_METRICS]) {
  metricRegistry.register(def);
}

export { MetricRegistry };
