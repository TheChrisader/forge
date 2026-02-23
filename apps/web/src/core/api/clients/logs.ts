import { apiClient } from "../client";
import type { Log, LogQueryParams, LogLevel } from "@forge/types";

function serializeLogParams(
  params: LogQueryParams | Omit<LogQueryParams, "sourceId" | "sourceType">
): Record<string, string | number | boolean | string[]> {
  const serialized: Record<string, string | number | boolean | string[]> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (key === "level" && Array.isArray(value)) {
      serialized[key] = value as LogLevel[];
    } else if (key === "level" && typeof value === "string") {
      serialized[key] = value;
    } else if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      serialized[key] = value;
    }
  }
  return serialized;
}

export const logsApi = {
  query: async (params: LogQueryParams): Promise<{ logs: Log[] }> => {
    return apiClient.get("/api/logs", { params: serializeLogParams(params) });
  },

  getProjectLogs: async (
    projectId: string,
    params?: Omit<LogQueryParams, "sourceId" | "sourceType">
  ): Promise<{ logs: Log[] }> => {
    return apiClient.get(`/api/projects/${projectId}/logs`, {
      params: params ? serializeLogParams(params) : undefined,
    });
  },
};
