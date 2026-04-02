import { apiClient } from "../client";

export interface EnvironmentVariableResponse {
  id: string;
  projectId: string;
  environmentId: string | null;
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertEnvVarsRequest {
  environmentId?: string | null;
  variables: Record<string, string>;
}

export const environmentVariablesApi = {
  list: async (
    projectId: string,
    environmentId?: string
  ): Promise<{ data: EnvironmentVariableResponse[] }> => {
    const params: Record<string, string> = {};
    if (environmentId) params.environmentId = environmentId;
    return apiClient.get(`/api/projects/${projectId}/environment-variables`, { params });
  },

  getResolved: async (
    projectId: string,
    environmentId?: string
  ): Promise<{ data: Record<string, string> }> => {
    const params: Record<string, string> = {};
    if (environmentId) params.environmentId = environmentId;
    return apiClient.get(`/api/projects/${projectId}/environment-variables/resolved`, { params });
  },

  upsert: async (
    projectId: string,
    data: UpsertEnvVarsRequest
  ): Promise<{ data: EnvironmentVariableResponse[] }> => {
    return apiClient.put(`/api/projects/${projectId}/environment-variables`, data);
  },

  delete: async (projectId: string, key: string, environmentId?: string): Promise<void> => {
    const params: Record<string, string> = {};
    if (environmentId) params.environmentId = environmentId;
    return apiClient.delete(`/api/projects/${projectId}/environment-variables/${key}`, { params });
  },
};
