import { apiClient } from "../client";

export interface DashboardStats {
  counts: {
    projects: number;
    deployments: number;
    containers: number;
    services: number;
  };
  trends: {
    projects: number;
    deployments: number;
    containers: number;
  };
  system: {
    cpuCores: number;
    cpuPercent: number;
    memoryTotalBytes: number;
    memoryUsedBytes: number;
    containersRunning: number;
    containersTotal: number;
    storage: {
      imagesSizeBytes: number;
      containersSizeBytes: number;
      volumesSizeBytes: number;
      totalSizeBytes: number;
    };
  };
}

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    return apiClient.get("/api/dashboard/stats");
  },
};
