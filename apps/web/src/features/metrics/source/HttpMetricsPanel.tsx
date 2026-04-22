import { useMemo } from "react";
import { TimeSeriesChart, ChartContainer } from "@/shared/components/ui/chart";
import { useMetricsQuery } from "@/core/api/hooks/useMetrics";
import { transformTimeSeriesResponse } from "../lib/transform-metrics";
import { formatRate, formatDuration } from "../lib/metric-formatters";
import type { DashboardFilters } from "../hooks/useMetricsDashboard";
import type { ChartSeries, ChartDataPoint } from "@/shared/components/ui/chart/chart-types";

interface HttpMetricsPanelProps {
  sourceType: string;
  sourceId: string;
  filters: DashboardFilters;
}

export function HttpMetricsPanel({
  sourceType,
  sourceId,
  filters,
}: HttpMetricsPanelProps): React.ReactElement {
  const queryParams = useMemo(
    () => ({
      sourceType: sourceType as "CONTAINER" | "SERVICE" | "SYSTEM" | "BUILD" | "DEPLOYMENT",
      sourceId,
      from: filters.timeRange.from.toISOString(),
      to: filters.timeRange.to.toISOString(),
      interval: filters.timeRange.interval,
      aggregation: "avg" as const,
    }),
    [sourceType, sourceId, filters]
  );

  const rateQuery = useMetricsQuery({
    ...queryParams,
    metric: "http_requests_total",
    aggregation: "sum",
  });

  const p50Query = useMetricsQuery({
    ...queryParams,
    metric: "http_request_duration_seconds",
    aggregation: "p50",
  });

  const p95Query = useMetricsQuery({
    ...queryParams,
    metric: "http_request_duration_seconds",
    aggregation: "p95",
  });

  const p99Query = useMetricsQuery({
    ...queryParams,
    metric: "http_request_duration_seconds",
    aggregation: "p99",
  });

  const errorQuery = useMetricsQuery({
    ...queryParams,
    metric: "http_request_errors_total",
    aggregation: "sum",
  });

  const rateData = useMemo(() => {
    if (!rateQuery.data?.length) return { data: [], series: [] as ChartSeries[] };
    return transformTimeSeriesResponse(rateQuery.data);
  }, [rateQuery.data]);

  const latencySeries = useMemo(() => {
    const allSeries: ChartSeries[] = [];
    const allData: Map<string, ChartDataPoint> = new Map();

    const datasets = [
      { result: p50Query.data, label: "p50" },
      { result: p95Query.data, label: "p95" },
      { result: p99Query.data, label: "p99" },
    ];

    for (const { result, label } of datasets) {
      if (!result?.length) continue;
      const transformed = transformTimeSeriesResponse(result);
      if (transformed.series[0]) {
        allSeries.push(transformed.series[0]);
        for (const point of transformed.data) {
          const key = point.timestamp;
          const existing = allData.get(key) ?? { timestamp: key };
          existing[label] = point[transformed.series[0].dataKey];
          allData.set(key, existing);
        }
      }
    }

    return {
      series: allSeries,
      data: Array.from(allData.values()),
    };
  }, [p50Query.data, p95Query.data, p99Query.data]);

  const errorData = useMemo(() => {
    if (!errorQuery.data?.length) return { data: [], series: [] as ChartSeries[] };
    return transformTimeSeriesResponse(errorQuery.data);
  }, [errorQuery.data]);

  return (
    <div className="space-y-6">
      <ChartContainer
        title="Request Rate"
        description="HTTP requests per interval"
        loading={rateQuery.isLoading}
        empty={!rateData.data.length}
        emptyMessage="No request data"
      >
        <TimeSeriesChart
          series={rateData.series}
          data={rateData.data}
          type="line"
          curveType="step"
          formatYAxis={(v) => formatRate(v, "req")}
          height={200}
        />
      </ChartContainer>

      <ChartContainer
        title="Latency Distribution"
        description="Request duration percentiles"
        loading={p50Query.isLoading && p95Query.isLoading && p99Query.isLoading}
        empty={!latencySeries.data.length}
        emptyMessage="No latency data"
      >
        <TimeSeriesChart
          series={latencySeries.series}
          data={latencySeries.data}
          type="line"
          curveType="monotone"
          formatYAxis={(v) => formatDuration(v)}
          formatTooltip={(v) => formatDuration(v)}
          height={200}
        />
      </ChartContainer>

      <ChartContainer
        title="Error Rate"
        description="HTTP error requests per interval"
        loading={errorQuery.isLoading}
        empty={!errorData.data.length}
        emptyMessage="No error data"
      >
        <TimeSeriesChart
          series={errorData.series}
          data={errorData.data}
          type="area"
          formatYAxis={(v) => formatRate(v, "err")}
          height={200}
        />
      </ChartContainer>
    </div>
  );
}
