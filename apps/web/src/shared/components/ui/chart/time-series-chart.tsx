import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { format, parseISO } from "date-fns";
import { ChartContainer } from "./chart-container";
import { ChartTooltip } from "./chart-tooltip";
import { getColorForSeries } from "./chart-colors";
import type { ChartDataPoint, ChartSeries } from "./chart-types";

interface TimeSeriesChartProps {
  series: ChartSeries[];
  data: ChartDataPoint[];
  xAxisKey?: string;
  yAxisLabel?: string;
  type?: "line" | "area";
  stacked?: boolean;
  height?: number;
  loading?: boolean;
  empty?: boolean;
  curveType?: "monotone" | "linear" | "step";
  showGrid?: boolean;
  showDots?: boolean;
  formatTooltip?: (value: number) => string;
  formatYAxis?: (value: number) => string;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

function formatXAxisTick(timestamp: string, rangeMs: number): string {
  try {
    const date = parseISO(timestamp);
    if (rangeMs < 3_600_000) return format(date, "HH:mm");
    if (rangeMs < 86_400_000) return format(date, "HH:mm");
    if (rangeMs < 604_800_000) return format(date, "EEE HH:mm");
    return format(date, "MMM dd");
  } catch {
    return timestamp;
  }
}

export function TimeSeriesChart({
  series,
  data,
  xAxisKey = "timestamp",
  yAxisLabel,
  type = "area",
  stacked = false,
  height = 250,
  loading,
  empty,
  curveType = "monotone",
  showGrid = true,
  showDots = false,
  formatTooltip,
  formatYAxis,
  title,
  description,
  actions,
}: TimeSeriesChartProps): React.ReactElement {
  const isEmpty = empty || data.length === 0;

  const xFormatters = useMemo(
    () =>
      formatTooltip ? Object.fromEntries(series.map((s) => [s.dataKey, formatTooltip])) : undefined,
    [series, formatTooltip]
  );

  const rangeMs = useMemo(() => {
    if (data.length < 2) return 0;
    try {
      const first = parseISO(data[0][xAxisKey] as string).getTime();
      const last = parseISO(data[data.length - 1][xAxisKey] as string).getTime();
      return last - first;
    } catch {
      return 0;
    }
  }, [data, xAxisKey]);

  const commonChartProps = { data, margin: { top: 4, right: 4, bottom: 4, left: 4 } as const };

  const seriesElements = series.map((s, index) => {
    const color = s.color || getColorForSeries(index);
    const baseProps = {
      // key: s.dataKey,
      type: curveType,
      dataKey: s.dataKey,
      name: s.name || s.dataKey,
      stroke: color,
      strokeWidth: 1.5,
      strokeDasharray: s.strokeDasharray,
      dot: showDots,
      activeDot: { r: 3, strokeWidth: 0 },
    };

    if (type === "area") {
      return (
        <Area
          {...baseProps}
          key={s.dataKey}
          fill={color}
          fillOpacity={0.2}
          stackId={stacked ? "1" : undefined}
        />
      );
    }
    return <Line {...baseProps} key={s.dataKey} />;
  });

  const gridElement = showGrid ? (
    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
  ) : null;

  const axisElements = (
    <>
      <XAxis
        dataKey={xAxisKey}
        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
        tickFormatter={(v: string) => formatXAxisTick(v, rangeMs)}
        tickLine={false}
        axisLine={false}
        minTickGap={40}
      />
      <YAxis
        label={
          yAxisLabel
            ? {
                value: yAxisLabel,
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
              }
            : undefined
        }
        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
        tickFormatter={formatYAxis}
        tickLine={false}
        axisLine={false}
        width={yAxisLabel ? 50 : 40}
      />
    </>
  );

  const tooltipElement = (
    <Tooltip
      content={
        <ChartTooltip
          formatters={xFormatters}
          dateFormat={rangeMs > 86_400_000 ? "datetime" : "time"}
        />
      }
    />
  );

  return (
    <ChartContainer
      title={title}
      description={description}
      loading={loading}
      empty={isEmpty}
      emptyMessage="No data available for this time range"
      height={height}
      actions={actions}
    >
      {type === "area" ? (
        <AreaChart {...commonChartProps}>
          {gridElement}
          {axisElements}
          {tooltipElement}
          {seriesElements}
        </AreaChart>
      ) : (
        <LineChart {...commonChartProps}>
          {gridElement}
          {axisElements}
          {tooltipElement}
          {seriesElements}
        </LineChart>
      )}
    </ChartContainer>
  );
}
