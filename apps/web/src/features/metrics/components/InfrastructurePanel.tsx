import { useMemo } from "react";
import { TimeSeriesChart, ChartContainer } from "@/shared/components/ui/chart";
import { useMetricsQuery } from "@/core/api/hooks/useMetrics";
import { transformTimeSeriesResponse } from "../lib/transform-metrics";
import { formatPercent } from "../lib/metric-formatters";
import type { DashboardFilters } from "../hooks/useMetricsDashboard";
import type { ChartSeries } from "@/shared/components/ui/chart/chart-types";

interface InfrastructurePanelProps {
  filters: DashboardFilters;
  isRecentWindow: boolean;
}

export function InfrastructurePanel({
  filters,
  isRecentWindow,
}: InfrastructurePanelProps): React.ReactElement {
  const queryParams = useMemo(
    () => ({
      metric: "cpu_usage_percent" as const,
      from: filters.timeRange.from.toISOString(),
      to: filters.timeRange.to.toISOString(),
      interval: filters.timeRange.interval,
      aggregation: "avg" as const,
      projectId: filters.projectId ?? undefined,
      sourceType: filters.sourceType ?? undefined,
    }),
    [filters]
  );

  const cpuQuery = useMetricsQuery(queryParams);

  const memoryParams = useMemo(
    () => ({ ...queryParams, metric: "memory_usage_percent" as const }),
    [queryParams]
  );

  const memoryQuery = useMetricsQuery(memoryParams);

  const cpuTransformed = useMemo(() => {
    if (!cpuQuery.data?.length) return { data: [], series: [] as ChartSeries[] };
    return transformTimeSeriesResponse(cpuQuery.data);
  }, [cpuQuery.data]);

  const memoryTransformed = useMemo(() => {
    if (!memoryQuery.data?.length) return { data: [], series: [] as ChartSeries[] };
    return transformTimeSeriesResponse(memoryQuery.data);
  }, [memoryQuery.data]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ChartContainer
        title="Platform CPU Usage"
        description="Average CPU utilization across all sources"
        loading={cpuQuery.isLoading}
        empty={!cpuTransformed.data.length}
        actions={
          isRecentWindow ? (
            <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-500">
              Live
            </span>
          ) : undefined
        }
      >
        <TimeSeriesChart
          series={cpuTransformed.series}
          data={cpuTransformed.data}
          type="area"
          formatYAxis={(v) => formatPercent(v, 0)}
          height={240}
        />
      </ChartContainer>

      <ChartContainer
        title="Platform Memory Usage"
        description="Average memory utilization across all sources"
        loading={memoryQuery.isLoading}
        empty={!memoryTransformed.data.length}
        actions={
          isRecentWindow ? (
            <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-500">
              Live
            </span>
          ) : undefined
        }
      >
        <TimeSeriesChart
          series={memoryTransformed.series}
          data={memoryTransformed.data}
          type="area"
          formatYAxis={(v) => formatPercent(v, 0)}
          height={240}
        />
      </ChartContainer>
    </div>
  );
}
