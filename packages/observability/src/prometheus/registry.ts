const MAX_LABEL_SETS_PER_METRIC = 10_000;

function serializeLabelKey(labels: Record<string, string>): string {
  return Object.keys(labels)
    .sort()
    .map((k) => `${k}=${labels[k]}`)
    .join(",");
}

export class PrometheusCounter {
  readonly name: string;
  readonly help: string;
  readonly labelNames: readonly string[];

  private readonly values = new Map<string, number>();

  constructor(name: string, help: string, labelNames?: string[]) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames ?? [];
  }

  inc(labels?: Record<string, string>, value: number = 1): void {
    const key = labels ? serializeLabelKey(labels) : "";
    if (labels && !this.values.has(key) && this.values.size >= MAX_LABEL_SETS_PER_METRIC) {
      return;
    }
    const current = this.values.get(key) ?? 0;
    this.values.set(key, current + value);
  }

  reset(): void {
    this.values.clear();
  }

  collect(): ReadonlyArray<{ labels: Record<string, string>; value: number }> {
    const result: Array<{ labels: Record<string, string>; value: number }> = [];
    for (const [key, value] of this.values) {
      const labels: Record<string, string> = {};
      if (key) {
        for (const pair of key.split(",")) {
          const eq = pair.indexOf("=");
          labels[pair.substring(0, eq)] = pair.substring(eq + 1);
        }
      }
      result.push({ labels, value });
    }
    return result;
  }
}

export class PrometheusGauge {
  readonly name: string;
  readonly help: string;
  readonly labelNames: readonly string[];

  private readonly values = new Map<string, number>();

  constructor(name: string, help: string, labelNames?: string[]) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames ?? [];
  }

  set(labels: Record<string, string>, value: number): void {
    const key = serializeLabelKey(labels);
    if (!this.values.has(key) && this.values.size >= MAX_LABEL_SETS_PER_METRIC) {
      return;
    }
    this.values.set(key, value);
  }

  reset(): void {
    this.values.clear();
  }

  collect(): ReadonlyArray<{ labels: Record<string, string>; value: number }> {
    const result: Array<{ labels: Record<string, string>; value: number }> = [];
    for (const [key, value] of this.values) {
      const labels: Record<string, string> = {};
      for (const pair of key.split(",")) {
        const eq = pair.indexOf("=");
        labels[pair.substring(0, eq)] = pair.substring(eq + 1);
      }
      result.push({ labels, value });
    }
    return result;
  }
}

interface HistogramSample {
  labels: Record<string, string>;
  buckets: ReadonlyMap<number, number>;
  sum: number;
  count: number;
}

export class PrometheusHistogram {
  readonly name: string;
  readonly help: string;
  readonly labelNames: readonly string[];
  readonly buckets: readonly number[];

  private readonly samples = new Map<
    string,
    { bucketCounts: number[]; sum: number; count: number }
  >();

  constructor(name: string, help: string, buckets: number[], labelNames?: string[]) {
    this.name = name;
    this.help = help;
    this.buckets = [...buckets].sort((a, b) => a - b);
    this.labelNames = labelNames ?? [];
  }

  observe(labels: Record<string, string>, value: number): void {
    const key = serializeLabelKey(labels);
    if (!this.samples.has(key) && this.samples.size >= MAX_LABEL_SETS_PER_METRIC) {
      return;
    }
    let sample = this.samples.get(key);
    if (!sample) {
      sample = {
        bucketCounts: (new Array(this.buckets.length) as number[]).fill(0),
        sum: 0,
        count: 0,
      };
      this.samples.set(key, sample);
    }
    sample.sum += value;
    sample.count++;
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) {
        sample.bucketCounts[i]++;
      }
    }
  }

  reset(): void {
    this.samples.clear();
  }

  collect(): ReadonlyArray<HistogramSample> {
    const result: HistogramSample[] = [];
    for (const [key, sample] of this.samples) {
      const labels: Record<string, string> = {};
      for (const pair of key.split(",")) {
        const eq = pair.indexOf("=");
        labels[pair.substring(0, eq)] = pair.substring(eq + 1);
      }

      const buckets = new Map<number, number>();
      let cumulative = 0;
      for (let i = 0; i < this.buckets.length; i++) {
        cumulative += sample.bucketCounts[i];
        buckets.set(this.buckets[i], cumulative);
      }

      result.push({ labels, buckets, sum: sample.sum, count: sample.count });
    }
    return result;
  }
}

type PrometheusMetric = PrometheusCounter | PrometheusGauge | PrometheusHistogram;

export class PrometheusRegistry {
  private readonly metrics = new Map<string, PrometheusMetric>();

  createCounter(name: string, help: string, labelNames?: string[]): PrometheusCounter {
    if (this.metrics.has(name)) {
      throw new Error(`Metric already registered: ${name}`);
    }
    const counter = new PrometheusCounter(name, help, labelNames);
    this.metrics.set(name, counter);
    return counter;
  }

  createGauge(name: string, help: string, labelNames?: string[]): PrometheusGauge {
    if (this.metrics.has(name)) {
      throw new Error(`Metric already registered: ${name}`);
    }
    const gauge = new PrometheusGauge(name, help, labelNames);
    this.metrics.set(name, gauge);
    return gauge;
  }

  createHistogram(
    name: string,
    help: string,
    buckets: number[],
    labelNames?: string[]
  ): PrometheusHistogram {
    if (this.metrics.has(name)) {
      throw new Error(`Metric already registered: ${name}`);
    }
    const histogram = new PrometheusHistogram(name, help, buckets, labelNames);
    this.metrics.set(name, histogram);
    return histogram;
  }

  getMetric(name: string): PrometheusMetric | undefined {
    return this.metrics.get(name);
  }

  getMetrics(): ReadonlyArray<PrometheusMetric> {
    return [...this.metrics.values()];
  }

  reset(): void {
    for (const metric of this.metrics.values()) {
      metric.reset();
    }
  }
}
