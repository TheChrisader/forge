import { apiClient } from "../client";
import type {
  Project,
  Deployment,
  CreateProjectRequest,
  UpdateProjectRequest,
  DeployProjectRequest,
  PaginatedResponse,
  CacheStats,
  CacheClearResult,
} from "@forge/types";

export const projectsApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Project>> => {
    return apiClient.get("/api/projects", { params });
  },

  getById: async (id: string): Promise<{ data: Project }> => {
    return apiClient.get(`/api/projects/${id}`);
  },

  create: async (data: CreateProjectRequest): Promise<{ data: Project }> => {
    return apiClient.post("/api/projects", data);
  },

  update: async (id: string, data: UpdateProjectRequest): Promise<{ data: Project }> => {
    return apiClient.put(`/api/projects/${id}`, data);
  },

  patch: async (id: string, data: UpdateProjectRequest): Promise<{ data: Project }> => {
    return apiClient.patch(`/api/projects/${id}`, data);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/api/projects/${id}`);
  },

  /**
   * DEPRECATED: This endpoint is a stub and not functional
   * Use deploymentsApi.create() instead which calls the working endpoint:
   * POST /api/deployments/projects/:projectId/deployments
   */
  deploy: async (id: string, data?: DeployProjectRequest): Promise<{ deployment: Deployment }> => {
    return apiClient.post(`/api/projects/${id}/deploy`, data);
  },

  /**
   * DEPRECATED: Rollback functionality - not yet implemented
   */
  rollback: async (id: string, deploymentId?: string): Promise<{ deployment: Deployment }> => {
    return apiClient.post(`/api/projects/${id}/rollback`, { deploymentId });
  },

  /**
   * DEPRECATED: Use deploymentsApi.getByProject() instead
   * This endpoint may not exist
   */
  getDeployments: async (id: string): Promise<{ deployments: Deployment[] }> => {
    return apiClient.get(`/api/projects/${id}/deployments`);
  },

  /**
   * DEPRECATED: Scale functionality - not yet implemented
   */
  scale: async (id: string, replicas: number): Promise<{ success: boolean }> => {
    return apiClient.post(`/api/projects/${id}/scale`, { replicas });
  },

  /**
   * Get build cache statistics for a project
   */
  getCacheStats: async (id: string): Promise<{ data: CacheStats }> => {
    return apiClient.get(`/api/projects/${id}/cache`);
  },

  /**
   * Clear build cache for a project
   */
  clearCache: async (id: string): Promise<{ data: CacheClearResult }> => {
    return apiClient.delete(`/api/projects/${id}/cache`);
  },
};
