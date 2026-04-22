import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";

interface TooltipPayloadEntry {
  name: string;
  value: number;
  dataKey: string;
  color: string;
  payload?: Record<string, unknown>;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  formatters?: Record<string, (value: number) => string>;
  dateFormat?: "time" | "datetime";
}

function formatLabel(raw: string, dateFormat: "time" | "datetime"): string {
  try {
    const date = parseISO(raw);
    return dateFormat === "time" ? format(date, "HH:mm") : format(date, "MMM dd HH:mm");
  } catch {
    return raw;
  }
}

function TooltipContent({
  active,
  payload,
  label,
  formatters,
  dateFormat = "time",
}: ChartTooltipProps): ReactNode {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      {label && (
        <p className="text-muted-foreground mb-1.5 text-xs">{formatLabel(label, dateFormat)}</p>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((entry) => {
          const formatter = formatters?.[entry.dataKey];
          const displayValue = formatter
            ? formatter(entry.value)
            : Number.isInteger(entry.value)
              ? String(entry.value)
              : entry.value.toFixed(2).replace(/\.0+$/, "");

          return (
            <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}</span>
              <span className="font-mono ml-auto">{displayValue}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { TooltipContent as ChartTooltip };

export const CHART_TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.5rem",
  fontSize: "0.75rem",
  color: "hsl(var(--popover-foreground))",
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
} as const;
