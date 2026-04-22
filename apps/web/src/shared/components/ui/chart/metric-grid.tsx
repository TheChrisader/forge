import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

interface MetricGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

const COLUMN_CLASSES: Record<number, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
};

export function MetricGrid({
  children,
  columns = 4,
  className,
}: MetricGridProps): React.ReactElement {
  return <div className={cn("grid gap-4", COLUMN_CLASSES[columns], className)}>{children}</div>;
}
