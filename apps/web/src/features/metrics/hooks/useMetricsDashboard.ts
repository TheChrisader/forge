import { useMemo, useState, useCallback } from "react";
import type { TimeRange, SourceType } from "@/shared/components/ui/chart/chart-types";
import { useMetricsStream } from "@/core/api/hooks/useMetricsStream";

const DEFAULT_TIME_RANGE: TimeRange = {
  from: new Date(Date.now() - 60 * 60 * 1000),
  to: new Date(),
  interval: "1m",
  label: "Last 1 hour",
};

interface DashboardFilters {
  timeRange: TimeRange;
  projectId: string | null;
  sourceType: SourceType | null;
}

interface UseMetricsDashboardOptions {
  sourceId?: string;
}

interface UseMetricsDashboardReturn {
  filters: DashboardFilters;
  setTimeRange: (range: TimeRange) => void;
  setProjectId: (id: string | null) => void;
  setSourceType: (type: SourceType | null) => void;
  streamValues: Map<string, number>;
  isStreaming: boolean;
  isRecentWindow: boolean;
}

export function useMetricsDashboard(
  options?: UseMetricsDashboardOptions
): UseMetricsDashboardReturn {
  const [timeRange, setTimeRange] = useState<TimeRange>(DEFAULT_TIME_RANGE);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<SourceType | null>(null);

  const isRecentWindow = useMemo(() => {
    const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
    return timeRange.from.getTime() >= thirtyMinAgo;
  }, [timeRange.from]);

  const stream = useMetricsStream({
    sourceId: options?.sourceId,
    projectId: projectId ?? undefined,
    enabled: isRecentWindow,
  });

  const streamValues = useMemo(() => {
    const values = new Map<string, number>();
    stream.latestValues.forEach((point, key) => {
      values.set(key, point.value);
    });
    return values;
  }, [stream.latestValues]);

  const filters: DashboardFilters = useMemo(
    () => ({ timeRange, projectId, sourceType }),
    [timeRange, projectId, sourceType]
  );

  return {
    filters,
    setTimeRange,
    setProjectId: useCallback((id: string | null) => setProjectId(id), []),
    setSourceType: useCallback((type: SourceType | null) => setSourceType(type), []),
    streamValues,
    isStreaming: stream.isStreaming,
    isRecentWindow,
  };
}

export type { DashboardFilters, UseMetricsDashboardReturn };
