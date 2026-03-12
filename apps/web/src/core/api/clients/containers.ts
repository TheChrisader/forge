import { apiClient } from "../client";
import type { DockerContainer, ContainerStats, ContainerLogEntry } from "@forge/types";

export interface ContainerLogsQueryParams {
  tail?: number | "all";
  follow?: boolean;
  stdout?: boolean;
  stderr?: boolean;
}

export interface ContainerExecRequest {
  command: string[];
}

export interface ContainerExecResult {
  exitCode: number;
  output: string;
  error?: string;
}

export const containersApi = {
  /**
   * Gets all containers for a project
   */
  getByProject: async (projectId: string): Promise<{ data: DockerContainer[] }> => {
    return apiClient.get(`/api/projects/${projectId}/containers`);
  },

  /**
   * Gets all containers for a deployment
   */
  getByDeployment: async (deploymentId: string): Promise<{ data: DockerContainer[] }> => {
    return apiClient.get(`/api/deployments/${deploymentId}/containers`);
  },

  /**
   * Gets a single container by ID
   */
  getById: async (id: string): Promise<{ data: DockerContainer }> => {
    return apiClient.get(`/api/containers/${id}`);
  },

  /**
   * Starts a container
   */
  start: async (id: string): Promise<void> => {
    return apiClient.post(`/api/containers/${id}/start`);
  },

  /**
   * Stops a container with optional timeout
   */
  stop: async (id: string, timeout?: number): Promise<void> => {
    return apiClient.post(`/api/containers/${id}/stop`, undefined, {
      params: { timeout: timeout?.toString() ?? "30" },
    });
  },

  /**
   * Restarts a container
   */
  restart: async (id: string): Promise<void> => {
    return apiClient.post(`/api/containers/${id}/restart`);
  },

  /**
   * Removes a container with optional force
   */
  remove: async (id: string, force?: boolean): Promise<void> => {
    return apiClient.delete(`/api/containers/${id}`, {
      params: { force: force?.toString() ?? "false" },
    });
  },

  /**
   * Gets logs from a container
   */
  getLogs: async (
    id: string,
    params?: ContainerLogsQueryParams
  ): Promise<{ data: ContainerLogEntry[] }> => {
    const cleanParams = Object.fromEntries(
      Object.entries(params ?? {}).filter(([_, v]) => v !== undefined)
    ) as Record<string, string | boolean>;
    return apiClient.get(`/api/containers/${id}/logs`, { params: cleanParams });
  },

  /**
   * Gets stats from a container
   */
  getStats: async (id: string): Promise<{ data: ContainerStats }> => {
    return apiClient.get(`/api/containers/${id}/stats`);
  },

  /**
   * Executes a command in a container
   */
  exec: async (id: string, data: ContainerExecRequest): Promise<{ data: ContainerExecResult }> => {
    return apiClient.post(`/api/containers/${id}/exec`, data);
  },
};
