import { useMemo } from "react";
import { TimeSeriesChart, ChartContainer } from "@/shared/components/ui/chart";
import { useMetricsQuery } from "@/core/api/hooks/useMetrics";
import { transformTimeSeriesResponse } from "../lib/transform-metrics";
import { formatBytes } from "../lib/metric-formatters";
import type { DashboardFilters } from "../hooks/useMetricsDashboard";
import type { ChartSeries } from "@/shared/components/ui/chart/chart-types";
import { HardDrive } from "lucide-react";

interface DiskPanelProps {
  sourceType: string;
  sourceId: string;
  filters: DashboardFilters;
}

export function DiskPanel({ sourceType, sourceId, filters }: DiskPanelProps): React.ReactElement {
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

  const readQuery = useMetricsQuery({ ...queryParams, metric: "block_io_read_bytes" });
  const writeQuery = useMetricsQuery({ ...queryParams, metric: "block_io_write_bytes" });

  const readData = useMemo(() => {
    if (!readQuery.data?.length) return { data: [], series: [] as ChartSeries[] };
    return transformTimeSeriesResponse(readQuery.data);
  }, [readQuery.data]);

  const writeData = useMemo(() => {
    if (!writeQuery.data?.length) return { data: [], series: [] as ChartSeries[] };
    return transformTimeSeriesResponse(writeQuery.data);
  }, [writeQuery.data]);

  const hasData = readData.data.length > 0 || writeData.data.length > 0;

  if (!hasData && !readQuery.isLoading && !writeQuery.isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border/50 p-6 text-muted-foreground">
        <HardDrive className="h-4 w-4 shrink-0" />
        <p className="font-mono text-xs">No disk I/O data available for this source.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ChartContainer
        title="Block I/O Read"
        description="Disk read bytes"
        loading={readQuery.isLoading}
        empty={!readData.data.length}
        emptyMessage="No read data"
      >
        <TimeSeriesChart
          series={readData.series}
          data={readData.data}
          type="area"
          formatYAxis={(v) => formatBytes(v, 0)}
          formatTooltip={(v) => formatBytes(v)}
          height={200}
        />
      </ChartContainer>

      <ChartContainer
        title="Block I/O Write"
        description="Disk write bytes"
        loading={writeQuery.isLoading}
        empty={!writeData.data.length}
        emptyMessage="No write data"
      >
        <TimeSeriesChart
          series={writeData.series}
          data={writeData.data}
          type="area"
          formatYAxis={(v) => formatBytes(v, 0)}
          formatTooltip={(v) => formatBytes(v)}
          height={200}
        />
      </ChartContainer>
    </div>
  );
}
