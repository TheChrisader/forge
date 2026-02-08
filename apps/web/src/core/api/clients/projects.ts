import { apiClient } from "../client";
import type {
  Project,
  Deployment,
  CreateProjectRequest,
  UpdateProjectRequest,
  DeployProjectRequest,
  PaginatedResponse,
} from "@forge/types";

export const projectsApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Project>> => {
    return apiClient.get("/api/projects", { params });
  },

  getById: async (id: string): Promise<{ project: Project }> => {
    return apiClient.get(`/api/projects/${id}`);
  },

  create: async (data: CreateProjectRequest): Promise<{ project: Project }> => {
    return apiClient.post("/api/projects", data);
  },

  update: async (id: string, data: UpdateProjectRequest): Promise<{ project: Project }> => {
    return apiClient.put(`/api/projects/${id}`, data);
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    return apiClient.delete(`/api/projects/${id}`);
  },

  deploy: async (id: string, data?: DeployProjectRequest): Promise<{ deployment: Deployment }> => {
    return apiClient.post(`/api/projects/${id}/deploy`, data);
  },

  rollback: async (id: string, deploymentId?: string): Promise<{ deployment: Deployment }> => {
    return apiClient.post(`/api/projects/${id}/rollback`, { deploymentId });
  },

  getDeployments: async (id: string): Promise<{ deployments: Deployment[] }> => {
    return apiClient.get(`/api/projects/${id}/deployments`);
  },

  scale: async (id: string, replicas: number): Promise<{ success: boolean }> => {
    return apiClient.post(`/api/projects/${id}/scale`, { replicas });
  },
};
