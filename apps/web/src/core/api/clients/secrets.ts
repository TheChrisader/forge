import { apiClient } from "../client";

export interface SecretResponse {
  id: string;
  key: string;
  description: string | null;
  lastAccessedAt: string | null;
  accessCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSecretRequest {
  key: string;
  value: string;
  description?: string;
}

export interface UpdateSecretRequest {
  value: string;
}

export const secretsApi = {
  list: async (projectId: string): Promise<{ data: SecretResponse[] }> => {
    return apiClient.get(`/api/projects/${projectId}/secrets`);
  },

  create: async (
    projectId: string,
    data: CreateSecretRequest
  ): Promise<{ data: SecretResponse }> => {
    return apiClient.post(`/api/projects/${projectId}/secrets`, data);
  },

  update: async (
    projectId: string,
    id: string,
    data: UpdateSecretRequest
  ): Promise<{ data: SecretResponse }> => {
    return apiClient.put(`/api/projects/${projectId}/secrets/${id}`, data);
  },

  delete: async (projectId: string, id: string): Promise<void> => {
    return apiClient.delete(`/api/projects/${projectId}/secrets/${id}`);
  },
};
