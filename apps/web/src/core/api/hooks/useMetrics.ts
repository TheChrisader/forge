import { useQuery } from "@tanstack/react-query";
import { metricsApi } from "../clients/metrics";
import type { MetricQueryParams } from "@forge/types";

export const metricKeys = {
  all: ["metrics"] as const,
  query: (params: MetricQueryParams) => [...metricKeys.all, "query", params] as const,
  source: (id: string, params: object) => [...metricKeys.all, "source", id, params] as const,
};

export function useMetrics(params: MetricQueryParams) {
  return useQuery({
    queryKey: metricKeys.query(params),
    queryFn: () => metricsApi.query(params),
    refetchInterval: 10000,
  });
}

export function useSourceMetrics(sourceId: string, params: Omit<MetricQueryParams, "source">) {
  return useQuery({
    queryKey: metricKeys.source(sourceId, params),
    queryFn: () => metricsApi.getForSource(sourceId, params),
    enabled: !!sourceId,
    refetchInterval: 10000,
  });
}
