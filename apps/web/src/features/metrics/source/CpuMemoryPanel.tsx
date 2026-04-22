import { useMemo } from "react";
import { TimeSeriesChart, GaugeChart, ChartContainer } from "@/shared/components/ui/chart";
import { useMetricsQuery, useMetricsLatest } from "@/core/api/hooks/useMetrics";
import { transformTimeSeriesResponse } from "../lib/transform-metrics";
import { formatPercent } from "../lib/metric-formatters";
import type { DashboardFilters } from "../hooks/useMetricsDashboard";
import type { ChartSeries } from "@/shared/components/ui/chart/chart-types";

interface CpuMemoryPanelProps {
  sourceType: string;
  sourceId: string;
  filters: DashboardFilters;
  streamValues: Map<string, number>;
  isRecentWindow: boolean;
}

export function CpuMemoryPanel({
  sourceType,
  sourceId,
  filters,
  streamValues,
  isRecentWindow,
}: CpuMemoryPanelProps): React.ReactElement {
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

  const cpuQuery = useMetricsQuery({ ...queryParams, metric: "cpu_usage_percent" });
  const memoryQuery = useMetricsQuery({ ...queryParams, metric: "memory_usage_percent" });

  const latestQuery = useMetricsLatest({
    sourceType,
    sourceId,
    metric: "cpu_usage_percent",
  });

  const cpuData = useMemo(() => {
    if (!cpuQuery.data?.length) return { data: [], series: [] as ChartSeries[] };
    return transformTimeSeriesResponse(cpuQuery.data);
  }, [cpuQuery.data]);

  const memoryData = useMemo(() => {
    if (!memoryQuery.data?.length) return { data: [], series: [] as ChartSeries[] };
    return transformTimeSeriesResponse(memoryQuery.data);
  }, [memoryQuery.data]);

  const currentCpu =
    streamValues.get("cpu_usage_percent") ??
    latestQuery.data?.find((v) => v.metric === "cpu_usage_percent")?.value ??
    0;

  const currentMemory =
    streamValues.get("memory_usage_percent") ??
    latestQuery.data?.find((v) => v.metric === "memory_usage_percent")?.value ??
    0;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ChartContainer
        title="CPU Usage"
        loading={cpuQuery.isLoading}
        empty={!cpuData.data.length}
        emptyMessage="No CPU data available for this source"
        actions={
          isRecentWindow ? (
            <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-500">
              Live
            </span>
          ) : undefined
        }
      >
        <div className="flex items-center justify-center pb-4">
          <GaugeChart
            value={currentCpu}
            max={100}
            label="CPU"
            unit="%"
            thresholds={{ warning: 60, critical: 80 }}
            size={140}
          />
        </div>
        <TimeSeriesChart
          series={cpuData.series}
          data={cpuData.data}
          type="area"
          formatYAxis={(v) => formatPercent(v, 0)}
          height={200}
        />
      </ChartContainer>

      <ChartContainer
        title="Memory Usage"
        loading={memoryQuery.isLoading}
        empty={!memoryData.data.length}
        emptyMessage="No memory data available for this source"
        actions={
          isRecentWindow ? (
            <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-500">
              Live
            </span>
          ) : undefined
        }
      >
        <div className="flex items-center justify-center pb-4">
          <GaugeChart
            value={currentMemory}
            max={100}
            label="Memory"
            unit="%"
            thresholds={{ warning: 70, critical: 85 }}
            size={140}
          />
        </div>
        <TimeSeriesChart
          series={memoryData.series}
          data={memoryData.data}
          type="area"
          formatYAxis={(v) => formatPercent(v, 0)}
          height={200}
        />
      </ChartContainer>
    </div>
  );
}
