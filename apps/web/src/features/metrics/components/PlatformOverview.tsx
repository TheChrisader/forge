import { MetricCard, MetricGrid } from "@/shared/components/ui/chart";
import { usePlatformSummary, useMetricsQuery } from "@/core/api/hooks/useMetrics";
import { extractSparklineData, calculateTrend } from "../lib/transform-metrics";
import { formatPercent } from "../lib/metric-formatters";
import type { DashboardFilters } from "../hooks/useMetricsDashboard";
import { useMemo } from "react";
import { Container, Hammer, Rocket, Activity } from "lucide-react";

interface PlatformOverviewProps {
  filters: DashboardFilters;
  streamValues: Map<string, number>;
}

export function PlatformOverview({ streamValues }: PlatformOverviewProps): React.ReactElement {
  const { data, isLoading } = usePlatformSummary();

  const sparklineParams = useMemo(
    () => ({
      from: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      to: new Date().toISOString(),
      interval: "5m" as const,
    }),
    []
  );

  const sparklineQuery = useMetricsQuery({
    ...sparklineParams,
    metric: "cpu_usage_percent",
    aggregation: "avg",
  });

  const sparklines = useMemo(() => {
    if (!sparklineQuery.data?.length) {
      return {
        containers: [] as number[],
        builds: [] as number[],
        deployDuration: [] as number[],
        requests: [] as number[],
      };
    }

    return {
      containers: extractSparklineData(sparklineQuery.data, "cpu_usage_percent"),
      builds: extractSparklineData(sparklineQuery.data, "cpu_usage_percent"),
      deployDuration: extractSparklineData(sparklineQuery.data, "cpu_usage_percent"),
      requests: extractSparklineData(sparklineQuery.data, "cpu_usage_percent"),
    };
  }, [sparklineQuery.data]);

  const containerValue = streamValues.get("active_containers") ?? data?.containers.active ?? 0;
  const buildValue = streamValues.get("build_total") ?? data?.builds.total ?? 0;
  const deployRate = data?.deployments.successRate ?? 0;
  const reqRate = streamValues.get("http_requests_total") ?? data?.requests.total ?? 0;

  const buildTrend = useMemo(() => {
    if (!data?.builds.successRate) return undefined;
    return calculateTrend(data.builds.successRate, 100);
  }, [data?.builds.successRate]);

  const deployTrend = useMemo(() => {
    if (deployRate === null) return undefined;
    return calculateTrend(deployRate, 100);
  }, [deployRate]);

  return (
    <MetricGrid columns={4}>
      <MetricCard
        title="Active Containers"
        value={containerValue}
        icon={<Container className="h-4 w-4" />}
        sparklineData={sparklines.containers}
        loading={isLoading}
      />

      <MetricCard
        title="Builds (24h)"
        value={buildValue}
        unit={
          data?.builds.successRate != null
            ? `${formatPercent(data.builds.successRate, 0)} success`
            : undefined
        }
        icon={<Hammer className="h-4 w-4" />}
        sparklineData={sparklines.builds}
        trend={buildTrend?.direction}
        trendLabel={buildTrend?.label}
        loading={isLoading}
      />

      <MetricCard
        title="Deploy Success"
        value={deployRate}
        unit="%"
        icon={<Rocket className="h-4 w-4" />}
        sparklineData={sparklines.deployDuration}
        trend={deployTrend?.direction}
        trendLabel={deployTrend?.label}
        trendDirection="positive-is-good"
        loading={isLoading}
      />

      <MetricCard
        title="HTTP Req/min"
        value={reqRate}
        icon={<Activity className="h-4 w-4" />}
        sparklineData={sparklines.requests}
        loading={isLoading}
      />
    </MetricGrid>
  );
}
