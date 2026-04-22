import { cn } from "@/shared/lib/utils";

interface LegendPayloadEntry {
  value: string;
  color: string;
  dataKey: string;
}

interface ChartLegendProps {
  payload?: LegendPayloadEntry[];
  onToggle?: (dataKey: string, visible: boolean) => void;
  hiddenSeries?: Set<string>;
  className?: string;
}

export function ChartLegend({
  payload,
  onToggle,
  hiddenSeries,
  className,
}: ChartLegendProps): React.ReactElement | null {
  if (!payload || payload.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}>
      {payload.map((entry) => {
        const hidden = hiddenSeries?.has(entry.dataKey) ?? false;

        return (
          <button
            key={entry.dataKey}
            type="button"
            onClick={() => onToggle?.(entry.dataKey, !hidden)}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs transition-opacity",
              hidden && "opacity-40 line-through",
              onToggle && "cursor-pointer hover:opacity-80"
            )}
          >
            <span
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.value}</span>
          </button>
        );
      })}
    </div>
  );
}
