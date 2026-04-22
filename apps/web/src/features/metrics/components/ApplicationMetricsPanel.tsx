import { useMemo } from "react";
import { TimeSeriesChart, ChartContainer } from "@/shared/components/ui/chart";
import { useMetricsQuery } from "@/core/api/hooks/useMetrics";
import { transformTimeSeriesResponse } from "../lib/transform-metrics";
import { formatDuration, formatRate } from "../lib/metric-formatters";
import type { DashboardFilters } from "../hooks/useMetricsDashboard";
import type { ChartSeries } from "@/shared/components/ui/chart/chart-types";

interface ApplicationMetricsPanelProps {
  filters: DashboardFilters;
  isRecentWindow: boolean;
}

export function ApplicationMetricsPanel({
  filters,
  isRecentWindow,
}: ApplicationMetricsPanelProps): React.ReactElement {
  const requestParams = useMemo(
    () => ({
      metric: "http_requests_total",
      from: filters.timeRange.from.toISOString(),
      to: filters.timeRange.to.toISOString(),
      interval: filters.timeRange.interval,
      aggregation: "sum" as const,
      projectId: filters.projectId ?? undefined,
      sourceType: filters.sourceType ?? undefined,
    }),
    [filters]
  );

  const requestQuery = useMetricsQuery(requestParams);

  const latencyParams = useMemo(
    () => ({
      ...requestParams,
      metric: "http_request_duration_seconds",
      aggregation: "p95" as const,
    }),
    [requestParams]
  );

  const latencyQuery = useMetricsQuery(latencyParams);

  const requestData = useMemo(() => {
    if (!requestQuery.data?.length) return { data: [], series: [] as ChartSeries[] };
    return transformTimeSeriesResponse(requestQuery.data);
  }, [requestQuery.data]);

  const latencyData = useMemo(() => {
    if (!latencyQuery.data?.length) return { data: [], series: [] as ChartSeries[] };
    return transformTimeSeriesResponse(latencyQuery.data);
  }, [latencyQuery.data]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ChartContainer
        title="HTTP Request Rate"
        description="Total requests per interval"
        loading={requestQuery.isLoading}
        empty={!requestData.data.length}
        actions={
          isRecentWindow ? (
            <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-500">
              Live
            </span>
          ) : undefined
        }
      >
        <TimeSeriesChart
          series={requestData.series}
          data={requestData.data}
          type="line"
          curveType="step"
          formatYAxis={(v) => formatRate(v, "req")}
          height={240}
        />
      </ChartContainer>

      <ChartContainer
        title="Response Time (p95)"
        description="95th percentile request latency"
        loading={latencyQuery.isLoading}
        empty={!latencyData.data.length}
        actions={
          isRecentWindow ? (
            <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-500">
              Live
            </span>
          ) : undefined
        }
      >
        <TimeSeriesChart
          series={latencyData.series}
          data={latencyData.data}
          type="line"
          curveType="monotone"
          formatYAxis={(v) => formatDuration(v)}
          formatTooltip={(v) => formatDuration(v)}
          height={240}
        />
      </ChartContainer>
    </div>
  );
}
