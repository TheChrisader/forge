import { useQuery } from "@tanstack/react-query";
import { logsApi } from "../clients/logs";
import type { LogQueryParams } from "@forge/types";

export const logKeys = {
  all: ["logs"] as const,
  query: (params: LogQueryParams) => [...logKeys.all, "query", params] as const,
  project: (id: string, params?: object) => [...logKeys.all, "project", id, params] as const,
};

export function useLogs(params: LogQueryParams) {
  return useQuery({
    queryKey: logKeys.query(params),
    queryFn: () => logsApi.query(params),
    refetchInterval: 5000,
  });
}

export function useProjectLogs(
  projectId: string,
  params?: Omit<LogQueryParams, "sourceId" | "sourceType">
) {
  return useQuery({
    queryKey: logKeys.project(projectId, params),
    queryFn: () => logsApi.getProjectLogs(projectId, params),
    enabled: !!projectId,
    refetchInterval: 5000,
  });
}
