import { apiClient } from "../client";
import type { Service, CreateServiceRequest, PaginatedResponse } from "@forge/types";

export const servicesApi = {
  getAll: async (params?: {
    projectId?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Service>> => {
    return apiClient.get("/api/services", { params });
  },

  getById: async (id: string): Promise<{ service: Service }> => {
    return apiClient.get(`/api/services/${id}`);
  },

  create: async (data: CreateServiceRequest): Promise<{ service: Service }> => {
    return apiClient.post("/api/services", data);
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    return apiClient.delete(`/api/services/${id}`);
  },

  getConnection: async (id: string): Promise<{ connection: Service["connection"] }> => {
    return apiClient.get(`/api/services/${id}/connection`);
  },
};
