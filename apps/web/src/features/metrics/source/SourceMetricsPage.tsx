import { useParams, Link } from "@tanstack/react-router";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useMetricsSources } from "@/core/api/hooks/useMetrics";
import { useMetricsDashboard } from "../hooks/useMetricsDashboard";
import { SourceHeader } from "./SourceHeader";
import { MetricsFilterBar } from "../components/MetricsFilterBar";
import { CpuMemoryPanel } from "./CpuMemoryPanel";
import { NetworkPanel } from "./NetworkPanel";
import { DiskPanel } from "./DiskPanel";
import { HttpMetricsPanel } from "./HttpMetricsPanel";
import type { SourceType } from "@/shared/components/ui/chart/chart-types";
import { AlertTriangle, ArrowLeft } from "lucide-react";

function shouldShowHttpMetrics(sourceType: string): boolean {
  return ["SERVICE", "SYSTEM"].includes(sourceType.toUpperCase());
}

function SourceNotFound({
  sourceType,
  sourceId,
}: {
  sourceType: string;
  sourceId: string;
}): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24">
      <AlertTriangle className="h-12 w-12 text-muted-foreground" />
      <div className="text-center">
        <h2 className="font-serif text-2xl font-bold">Source Not Found</h2>
        <p className="mt-2 font-mono text-sm text-muted-foreground">
          No source found with type &quot;{sourceType}&quot; and ID &quot;{sourceId}&quot;
        </p>
      </div>
      <Link
        to="/metrics"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Metrics
      </Link>
    </div>
  );
}

function SourceMetricsLoadingSkeleton(): React.ReactElement {
  return (
    <div className="space-y-6">
      <div className="space-y-2 border-b border-border/50 pb-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-64" />
      </div>
      <Skeleton className="h-9 w-full" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-90 w-full" />
        <Skeleton className="h-90 w-full" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-60 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    </div>
  );
}

export function SourceMetricsPage(): React.ReactElement {
  const { sourceType, sourceId } = useParams({
    from: "/authenticated/metrics/source/$sourceType/$sourceId",
  });
  const dashboard = useMetricsDashboard({ sourceId });
  const sources = useMetricsSources({ sourceType });

  const sourceInfo = sources.data?.find((s) => s.sourceId === sourceId);

  if (sources.isLoading) return <SourceMetricsLoadingSkeleton />;
  if (!sourceInfo) {
    return <SourceNotFound sourceType={sourceType} sourceId={sourceId} />;
  }

  return (
    <div className="space-y-6">
      <SourceHeader sourceType={sourceType} sourceId={sourceId} />

      <MetricsFilterBar
        filters={dashboard.filters}
        onTimeRangeChange={dashboard.setTimeRange}
        onProjectChange={() => {}}
        onSourceTypeChange={() => {}}
        showProjectFilter={false}
        showSourceTypeFilter={false}
        streamingIndicator={dashboard.isStreaming}
      />

      <CpuMemoryPanel
        sourceType={sourceType as SourceType}
        sourceId={sourceId}
        filters={dashboard.filters}
        streamValues={dashboard.streamValues}
        isRecentWindow={dashboard.isRecentWindow}
      />

      <NetworkPanel
        sourceType={sourceType as SourceType}
        sourceId={sourceId}
        filters={dashboard.filters}
      />

      <DiskPanel
        sourceType={sourceType as SourceType}
        sourceId={sourceId}
        filters={dashboard.filters}
      />

      {shouldShowHttpMetrics(sourceType) && (
        <HttpMetricsPanel
          sourceType={sourceType as SourceType}
          sourceId={sourceId}
          filters={dashboard.filters}
        />
      )}
    </div>
  );
}
