import { useMemo } from "react";
import { TimeSeriesChart, ChartContainer } from "@/shared/components/ui/chart";
import { useMetricsQuery } from "@/core/api/hooks/useMetrics";
import { transformTimeSeriesResponse } from "../lib/transform-metrics";
import { formatBytes } from "../lib/metric-formatters";
import type { DashboardFilters } from "../hooks/useMetricsDashboard";
import type { ChartSeries } from "@/shared/components/ui/chart/chart-types";

interface NetworkPanelProps {
  sourceType: string;
  sourceId: string;
  filters: DashboardFilters;
}

export function NetworkPanel({
  sourceType,
  sourceId,
  filters,
}: NetworkPanelProps): React.ReactElement {
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

  const rxQuery = useMetricsQuery({ ...queryParams, metric: "network_rx_bytes" });
  const txQuery = useMetricsQuery({ ...queryParams, metric: "network_tx_bytes" });

  const rxData = useMemo(() => {
    if (!rxQuery.data?.length) return { data: [], series: [] as ChartSeries[] };
    return transformTimeSeriesResponse(rxQuery.data);
  }, [rxQuery.data]);

  const txData = useMemo(() => {
    if (!txQuery.data?.length) return { data: [], series: [] as ChartSeries[] };
    return transformTimeSeriesResponse(txQuery.data);
  }, [txQuery.data]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ChartContainer
        title="Network RX"
        description="Bytes received"
        loading={rxQuery.isLoading}
        empty={!rxData.data.length}
        emptyMessage="No network RX data available"
      >
        <TimeSeriesChart
          series={rxData.series}
          data={rxData.data}
          type="area"
          formatYAxis={(v) => formatBytes(v, 0)}
          formatTooltip={(v) => formatBytes(v)}
          height={200}
        />
      </ChartContainer>

      <ChartContainer
        title="Network TX"
        description="Bytes sent"
        loading={txQuery.isLoading}
        empty={!txData.data.length}
        emptyMessage="No network TX data available"
      >
        <TimeSeriesChart
          series={txData.series}
          data={txData.data}
          type="area"
          formatYAxis={(v) => formatBytes(v, 0)}
          formatTooltip={(v) => formatBytes(v)}
          height={200}
        />
      </ChartContainer>
    </div>
  );
}
