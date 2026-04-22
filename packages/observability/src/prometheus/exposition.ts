import {
  PrometheusRegistry,
  PrometheusCounter,
  PrometheusGauge,
  PrometheusHistogram,
} from "./registry.js";

export function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

export function formatPrometheusValue(value: number): string {
  if (Number.isNaN(value)) return "NaN";
  if (!Number.isFinite(value)) return value > 0 ? "+Inf" : "-Inf";
  return String(value);
}

function renderLabels(labels: Record<string, string>): string {
  const entries = Object.entries(labels)
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `${k}="${escapeLabelValue(v)}"`);
  return entries.length > 0 ? `{${entries.join(",")}}` : "";
}

export function renderMetricSamples(
  name: string,
  help: string,
  type: "counter" | "gauge",
  samples: ReadonlyArray<{ labels: Record<string, string>; value: number }>
): string {
  if (samples.length === 0) return "";

  const lines: string[] = [];
  lines.push(`# HELP ${name} ${help}`);
  lines.push(`# TYPE ${name} ${type}`);

  for (const sample of samples) {
    if (Number.isNaN(sample.value)) continue;
    const labelStr = renderLabels(sample.labels);
    lines.push(`${name}${labelStr} ${formatPrometheusValue(sample.value)}`);
  }

  return lines.join("\n") + "\n";
}

export function renderHistogramSamples(
  name: string,
  help: string,
  buckets: readonly number[],
  samples: ReadonlyArray<{
    labels: Record<string, string>;
    buckets: ReadonlyMap<number, number>;
    sum: number;
    count: number;
  }>
): string {
  if (samples.length === 0) return "";

  const lines: string[] = [];
  lines.push(`# HELP ${name} ${help}`);
  lines.push(`# TYPE ${name} histogram`);

  const sortedBuckets = [...buckets].sort((a, b) => a - b);

  for (const sample of samples) {
    const { labels } = sample;
    const baseLabels = renderLabels(labels);

    for (const boundary of sortedBuckets) {
      const cumulative = sample.buckets.get(boundary) ?? 0;
      const leLabel = baseLabels
        ? baseLabels.slice(0, -1) + `,le="${formatPrometheusValue(boundary)}"}`
        : `{le="${formatPrometheusValue(boundary)}"}`;
      lines.push(`${name}_bucket${leLabel} ${cumulative}`);
    }

    const infLabel = baseLabels ? baseLabels.slice(0, -1) + `,le="+Inf"}` : `{le="+Inf"}`;
    lines.push(`${name}_bucket${infLabel} ${sample.count}`);
    lines.push(`${name}_sum${baseLabels} ${formatPrometheusValue(sample.sum)}`);
    lines.push(`${name}_count${baseLabels} ${sample.count}`);
  }

  return lines.join("\n") + "\n";
}

export function renderExposition(registry: PrometheusRegistry): string {
  const metrics = registry.getMetrics();
  if (metrics.length === 0) return "";

  const parts: string[] = [];

  for (const metric of metrics) {
    if (metric instanceof PrometheusCounter) {
      const samples = metric.collect();
      parts.push(renderMetricSamples(metric.name, metric.help, "counter", samples));
    } else if (metric instanceof PrometheusGauge) {
      const samples = metric.collect();
      parts.push(renderMetricSamples(metric.name, metric.help, "gauge", samples));
    } else if (metric instanceof PrometheusHistogram) {
      const samples = metric.collect();
      parts.push(renderHistogramSamples(metric.name, metric.help, metric.buckets, samples));
    }
  }

  return parts.join("");
}
