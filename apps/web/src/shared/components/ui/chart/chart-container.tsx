import type { ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

interface ChartContainerProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  height?: number;
  actions?: ReactNode;
}

export function ChartContainer({
  title,
  description,
  children,
  className,
  loading,
  empty,
  emptyMessage = "No data available",
  height = 250,
  actions,
}: ChartContainerProps): React.ReactElement {
  return (
    <div className={cn("rounded-xl border bg-card text-card-foreground", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            {title && <h3 className="font-serif text-sm font-semibold">{title}</h3>}
            {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-4">
        {loading ? (
          <Skeleton className="h-full w-full" style={{ height }} />
        ) : empty ? (
          <div
            className="flex items-center justify-center text-muted-foreground text-sm"
            style={{ height }}
          >
            {emptyMessage}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            {children as React.ReactElement}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
