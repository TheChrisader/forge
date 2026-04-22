import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import {
  metricsApi,
  type MetricsQueryParams,
  type LatestQueryParams,
  type SourcesQueryParams,
  type TimeSeriesResult,
  type LatestMetricValue,
  type MetricSource,
  type PlatformSummary,
} from "../clients/metrics";

export type {
  MetricsQueryParams,
  LatestQueryParams,
  SourcesQueryParams,
  TimeSeriesResult,
  LatestMetricValue,
  MetricSource,
  PlatformSummary,
};

const METRICS_REFRESH_INTERVAL = 10_000;

export function useMetricsQuery(
  params: MetricsQueryParams
): UseQueryResult<TimeSeriesResult[], Error> {
  return useQuery<TimeSeriesResult[], Error>({
    queryKey: ["metrics", "query", params],
    queryFn: () => metricsApi.query(params),
    refetchInterval: METRICS_REFRESH_INTERVAL,
    enabled: !!params.from && !!params.to,
  });
}

export function useMetricsLatest(
  params?: LatestQueryParams
): UseQueryResult<LatestMetricValue[], Error> {
  return useQuery<LatestMetricValue[], Error>({
    queryKey: ["metrics", "latest", params],
    queryFn: () => metricsApi.getLatest(params),
    refetchInterval: METRICS_REFRESH_INTERVAL,
  });
}

export function useMetricsSources(
  params?: SourcesQueryParams
): UseQueryResult<MetricSource[], Error> {
  return useQuery<MetricSource[], Error>({
    queryKey: ["metrics", "sources", params],
    queryFn: () => metricsApi.getSources(params),
  });
}

export function useSourceMetrics(
  sourceType: string,
  sourceId: string,
  params: { from: string; to: string; interval?: string }
): UseQueryResult<TimeSeriesResult[], Error> {
  return useQuery<TimeSeriesResult[], Error>({
    queryKey: ["metrics", "source", sourceType, sourceId, params],
    queryFn: () => metricsApi.getSourceMetrics(sourceType, sourceId, params),
    refetchInterval: METRICS_REFRESH_INTERVAL,
    enabled: !!sourceType && !!sourceId && !!params.from && !!params.to,
  });
}

export function usePlatformSummary(): UseQueryResult<PlatformSummary, Error> {
  return useQuery<PlatformSummary, Error>({
    queryKey: ["metrics", "summary"],
    queryFn: () => metricsApi.getSummary(),
    refetchInterval: METRICS_REFRESH_INTERVAL,
  });
}
