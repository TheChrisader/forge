import { MetricsFilterBar } from "./components/MetricsFilterBar";
import { PlatformOverview } from "./components/PlatformOverview";
import { InfrastructurePanel } from "./components/InfrastructurePanel";
import { ApplicationMetricsPanel } from "./components/ApplicationMetricsPanel";
import { TopSourcesTable } from "./components/TopSourcesTable";
import { MetricAlertsList } from "./components/MetricAlertsList";
import { useMetricsDashboard } from "./hooks/useMetricsDashboard";

export function MetricsPage(): React.ReactElement {
  const dashboard = useMetricsDashboard();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border/50 pb-4">
        <h1 className="font-serif text-3xl font-bold">Metrics</h1>
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Platform monitoring &amp; observability
        </p>
      </div>

      {/* Filter Bar */}
      <MetricsFilterBar
        filters={dashboard.filters}
        onTimeRangeChange={dashboard.setTimeRange}
        onProjectChange={dashboard.setProjectId}
        onSourceTypeChange={dashboard.setSourceType}
        streamingIndicator={dashboard.isStreaming}
      />

      {/* Summary Cards */}
      <PlatformOverview filters={dashboard.filters} streamValues={dashboard.streamValues} />

      {/* Infrastructure Charts */}
      <InfrastructurePanel filters={dashboard.filters} isRecentWindow={dashboard.isRecentWindow} />

      {/* Application Metrics */}
      <ApplicationMetricsPanel
        filters={dashboard.filters}
        isRecentWindow={dashboard.isRecentWindow}
      />

      {/* Bottom Row: Alerts + Top Sources */}
      <div className="grid gap-6 lg:grid-cols-2">
        <MetricAlertsList projectId={dashboard.filters.projectId} />
        <TopSourcesTable />
      </div>
    </div>
  );
}
