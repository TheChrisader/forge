import { apiClient } from "../client";
import type { Metric, MetricQueryParams } from "@forge/types";

function serializeMetricParams(
  params: MetricQueryParams | Omit<MetricQueryParams, "source">
): Record<string, string> {
  const serialized: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      serialized[key] = String(value);
    }
  }
  return serialized;
}

export const metricsApi = {
  query: async (params: MetricQueryParams): Promise<{ metrics: Metric[] }> => {
    return apiClient.get("/api/metrics", { params: serializeMetricParams(params) });
  },

  getForSource: async (
    sourceId: string,
    params: Omit<MetricQueryParams, "source">
  ): Promise<{ metrics: Metric[] }> => {
    return apiClient.get("/api/metrics", {
      params: serializeMetricParams({ ...params, source: sourceId }),
    });
  },
};
