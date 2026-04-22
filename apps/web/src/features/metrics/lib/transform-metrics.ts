import type { ChartDataPoint, ChartSeries } from "@/shared/components/ui/chart/chart-types";
import { getColorForMetric } from "@/shared/components/ui/chart/chart-colors";

interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  sampleCount?: number;
}

interface TimeSeriesResult {
  metric: string;
  sourceType: string;
  sourceId: string;
  sourceName: string;
  unit: string | null;
  labels: Record<string, string> | null;
  points: TimeSeriesPoint[];
}

interface LatestMetricValue {
  metric: string;
  sourceType: string;
  sourceId: string;
  sourceName: string;
  value: number;
  unit: string | null;
  timestamp: string;
}

interface MetricStreamPoint {
  metric: string;
  value: number;
  timestamp: string;
  unit?: string;
}

interface MetricStreamEvent {
  sourceType: string;
  sourceId: string;
  sourceName: string;
  metrics: MetricStreamPoint[];
}

export function transformTimeSeriesResponse(response: TimeSeriesResult[]): {
  data: ChartDataPoint[];
  series: ChartSeries[];
} {
  if (!response || response.length === 0) {
    return { data: [], series: [] };
  }

  const pointMap = new Map<string, ChartDataPoint>();
  const metricNames = new Set<string>();

  for (const result of response) {
    if (!result.points || result.points.length === 0) continue;

    metricNames.add(result.metric);

    for (const point of result.points) {
      const existing = pointMap.get(point.timestamp);
      if (existing) {
        existing[result.metric] = point.value;
      } else {
        pointMap.set(point.timestamp, {
          timestamp: point.timestamp,
          [result.metric]: point.value,
        });
      }
    }
  }

  const data = Array.from(pointMap.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const series: ChartSeries[] = Array.from(metricNames).map((name) => ({
    dataKey: name,
    name,
    color: getColorForMetric(name),
  }));

  return { data, series };
}

export function transformLatestResponse(
  response: LatestMetricValue[]
): Map<string, { value: number; unit: string | null; timestamp: string; sourceName: string }> {
  const map = new Map<
    string,
    { value: number; unit: string | null; timestamp: string; sourceName: string }
  >();

  if (!response) return map;

  for (const item of response) {
    map.set(item.metric, {
      value: item.value,
      unit: item.unit,
      timestamp: item.timestamp,
      sourceName: item.sourceName,
    });
  }

  return map;
}

export function extractSparklineData(response: TimeSeriesResult[], metricName: string): number[] {
  const result = response.find((r) => r.metric === metricName);
  if (!result?.points) return [];
  return result.points.map((p) => p.value);
}

export function calculateTrend(
  current: number,
  previous: number
): { direction: "up" | "down" | "flat"; percentChange: number | null; label: string } {
  if (previous === 0) {
    if (current === 0) return { direction: "flat", percentChange: null, label: "No change" };
    return { direction: "up", percentChange: null, label: "No previous data" };
  }

  const change = ((current - previous) / Math.abs(previous)) * 100;
  const direction: "up" | "down" | "flat" =
    Math.abs(change) < 0.5 ? "flat" : change > 0 ? "up" : "down";
  const sign = change >= 0 ? "+" : "";

  return {
    direction,
    percentChange: Math.abs(change),
    label: `${sign}${change.toFixed(1)}% from previous`,
  };
}

export function mergeStreamData(
  existing: ChartDataPoint[],
  event: MetricStreamEvent,
  maxPoints = 120
): ChartDataPoint[] {
  const next = [...existing];

  for (const point of event.metrics) {
    const last = next[next.length - 1];
    if (last && last.timestamp === point.timestamp) {
      last[point.metric] = point.value;
    } else {
      next.push({ timestamp: point.timestamp, [point.metric]: point.value });
    }
  }

  if (next.length > maxPoints) {
    return next.slice(next.length - maxPoints);
  }

  return next;
}
