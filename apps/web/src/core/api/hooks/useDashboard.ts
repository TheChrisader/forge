import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { dashboardApi } from "../clients/dashboard";
import type { DashboardStats } from "../clients/dashboard";

const DASHBOARD_REFRESH_INTERVAL_MS = 10_000;

export const dashboardKeys = {
  all: ["dashboard"] as const,
  stats: ["dashboard", "stats"] as const,
};

export function useDashboardStats(): UseQueryResult<DashboardStats, Error> {
  return useQuery<DashboardStats>({
    queryKey: dashboardKeys.stats,
    queryFn: () => dashboardApi.getStats(),
    refetchInterval: DASHBOARD_REFRESH_INTERVAL_MS,
    staleTime: 5_000,
  });
}
