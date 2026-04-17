import { apiClient } from "../client";
import type {
  Deployment,
  DeploymentLogsResponse,
  DeploymentLogsQuery,
  DeploymentWithRelations,
  DeploymentStrategy,
} from "@forge/types";

export interface CreateDeploymentRequest {
  gitBranch?: string;
  gitCommit?: string;
  buildArgs?: Record<string, string>;
  strategy?: DeploymentStrategy;
}

export interface DeploymentListParams {
  projectId?: string;
  status?: string[];
  strategy?: string;
  search?: string;
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
    const cleanParams: Record<string, string | number> = {};

    if (params?.projectId) cleanParams.projectId = params.projectId;
    if (params?.status && Array.isArray(params.status)) {
      cleanParams.status = params.status.join(",");
    }
    if (params?.strategy) cleanParams.strategy = params.strategy;
    if (params?.search) cleanParams.search = params.search;
    if (params?.page) cleanParams.page = params.page;
    if (params?.limit) cleanParams.limit = params.limit;

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

  getById: async (id: string): Promise<{ data: DeploymentWithRelations }> => {
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
