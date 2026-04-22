import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { TimeRangeSelector } from "@/shared/components/ui/chart/time-range-selector";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useMetricsSources } from "@/core/api/hooks/useMetrics";
import type { DashboardFilters } from "../hooks/useMetricsDashboard";
import type { SourceType } from "@/shared/components/ui/chart/chart-types";
import { cn } from "@/shared/lib/utils";

const SOURCE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "CONTAINER", label: "Containers" },
  { value: "SERVICE", label: "Services" },
  { value: "BUILD", label: "Builds" },
  { value: "DEPLOYMENT", label: "Deployments" },
  { value: "SYSTEM", label: "System" },
];

interface MetricsFilterBarProps {
  filters: DashboardFilters;
  onTimeRangeChange: (range: import("@/shared/components/ui/chart/chart-types").TimeRange) => void;
  onProjectChange: (projectId: string | null) => void;
  onSourceTypeChange: (sourceType: SourceType | null) => void;
  showProjectFilter?: boolean;
  showSourceTypeFilter?: boolean;
  streamingIndicator?: boolean;
}

export function MetricsFilterBar({
  filters,
  onTimeRangeChange,
  onProjectChange,
  onSourceTypeChange,
  showProjectFilter = true,
  showSourceTypeFilter = true,
  streamingIndicator = false,
}: MetricsFilterBarProps): React.ReactElement {
  const { data: sources = [], isLoading: sourcesLoading } = useMetricsSources();

  const projects = sources
    ? Array.from(new Set(sources.map((s) => s.sourceName).filter(Boolean)))
        .sort()
        .map((name) => ({ value: name, label: name }))
    : [];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {showProjectFilter && (
        <div className="min-w-45">
          {sourcesLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <Select
              value={filters.projectId ?? "__all__"}
              onValueChange={(val) => onProjectChange(val === "__all__" ? null : val)}
            >
              <SelectTrigger className="h-9 font-mono text-xs">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {showSourceTypeFilter && (
        <div className="min-w-37.5">
          <Select
            value={filters.sourceType ?? "__all__"}
            onValueChange={(val) =>
              onSourceTypeChange(val === "__all__" ? null : (val as SourceType))
            }
          >
            <SelectTrigger className="h-9 font-mono text-xs">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Types</SelectItem>
              {SOURCE_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex-1" />

      <TimeRangeSelector value={filters.timeRange} onChange={onTimeRangeChange} />

      {streamingIndicator && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-500">
          <span
            className={cn("inline-block h-2 w-2 rounded-full bg-emerald-500", "animate-pulse")}
          />
          <span className="font-mono font-medium">Live</span>
        </div>
      )}
    </div>
  );
}
