import { apiClient } from "../client";
import type { Deployment, DeploymentLogsResponse, DeploymentLogsQuery } from "@forge/types";

export interface CreateDeploymentRequest {
  gitBranch?: string;
  gitCommit?: string;
  buildArgs?: Record<string, string>;
}

export interface DeploymentListParams {
  projectId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const deploymentsApi = {
  getAll: async (
    params?: DeploymentListParams
  ): Promise<{
    data: Deployment[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> => {
    const cleanParams = Object.fromEntries(
      Object.entries(params ?? {}).filter(([_, v]) => v !== undefined)
    ) as Record<string, string | number | boolean | string[]>;

    return apiClient.get("/api/deployments", { params: cleanParams });
  },

  getByProject: async (
    projectId: string,
    page = 1,
    limit = 10
  ): Promise<{
    data: Deployment[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> => {
    return apiClient.get("/api/deployments", {
      params: { projectId, page, limit },
    });
  },

  getById: async (id: string): Promise<{ data: Deployment }> => {
    return apiClient.get(`/api/deployments/${id}`);
  },

  create: async (
    projectId: string,
    data?: CreateDeploymentRequest
  ): Promise<{ data: Deployment }> => {
    return apiClient.post(`/api/deployments/projects/${projectId}/deployments`, data);
  },

  cancel: async (id: string): Promise<{ data: Deployment }> => {
    return apiClient.post(`/api/deployments/${id}/cancel`);
  },

  getLogs: async (id: string, params?: DeploymentLogsQuery): Promise<DeploymentLogsResponse> => {
    return apiClient.get(`/api/deployments/${id}/logs`, { params });
  },
};
