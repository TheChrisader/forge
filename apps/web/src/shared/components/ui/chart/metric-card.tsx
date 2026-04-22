import type { ReactNode } from "react";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { SparklineChart } from "./sparkline-chart";
import { getTrendColor } from "@/features/metrics/lib/metric-colors";
import { formatNumber } from "@/features/metrics/lib/metric-formatters";

interface MetricCardProps {
  title: string;
  value: number;
  unit?: string;
  previousValue?: number;
  trend?: "up" | "down" | "flat";
  trendLabel?: string;
  trendDirection?: "positive-is-good" | "negative-is-good" | "neutral";
  sparklineData?: number[];
  sparklineColor?: string;
  icon?: ReactNode;
  loading?: boolean;
  className?: string;
}

function inferTrend(
  current: number,
  previous: number
): { direction: "up" | "down" | "flat"; percentChange: number } {
  if (previous === 0) return { direction: current > 0 ? "up" : "flat", percentChange: 0 };
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const direction = Math.abs(change) < 0.5 ? "flat" : change > 0 ? "up" : "down";
  return { direction, percentChange: Math.abs(change) };
}

function TrendArrow({
  direction,
  semantics,
}: {
  direction: "up" | "down" | "flat";
  semantics: "positive-is-good" | "negative-is-good" | "neutral";
}): React.ReactElement {
  const color = getTrendColor(direction, semantics);
  const Icon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : ArrowRight;

  return <Icon size={14} className={cn("inline-block")} style={{ color }} />;
}

export function MetricCard({
  title,
  value,
  unit,
  previousValue,
  trend: trendProp,
  trendLabel,
  trendDirection = "neutral",
  sparklineData,
  sparklineColor,
  icon,
  loading,
  className,
}: MetricCardProps): React.ReactElement {
  if (loading) {
    return (
      <Card className={cn("p-4", className)}>
        <div className="flex items-center gap-2">
          {icon && <Skeleton className="h-4 w-4 rounded" />}
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="mt-3 flex items-end justify-between">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="mt-2 h-3 w-16" />
      </Card>
    );
  }

  const inferred = previousValue !== undefined ? inferTrend(value, previousValue) : null;
  const trend = trendProp ?? inferred?.direction ?? "flat";
  const percentChange = inferred?.percentChange ?? null;
  const displayTrendLabel =
    trendLabel ??
    (percentChange !== null && percentChange > 0.5
      ? `${percentChange.toFixed(0)}% from previous period`
      : undefined);

  return (
    <Card className={cn("group/card p-4 transition-colors hover:bg-accent/30", className)}>
      <div className="flex items-center gap-2">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-muted-foreground text-xs font-medium">{title}</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          <span className="font-mono text-lg font-semibold">{formatNumber(value)}</span>
          {unit && <span className="text-muted-foreground ml-1 text-xs">{unit}</span>}
        </div>
        {sparklineData && (
          <div className="shrink-0">
            <SparklineChart data={sparklineData} color={sparklineColor} width={80} height={28} />
          </div>
        )}
      </div>
      {(trend !== "flat" || displayTrendLabel) && (
        <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
          <TrendArrow direction={trend} semantics={trendDirection} />
          {displayTrendLabel && <span>{displayTrendLabel}</span>}
        </div>
      )}
    </Card>
  );
}
