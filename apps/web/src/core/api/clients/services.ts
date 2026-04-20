import { apiClient } from "../client";
import type {
  Service,
  CreateServiceRequest,
  ServiceBackup,
  PaginatedResponse,
  ServiceType,
} from "@forge/types";

export interface EngineDetail {
  type: ServiceType;
  engine: string;
  displayName: string;
  description: string;
  icon: string;
  supportedVersions: Array<{
    version: string;
    imageTag: string;
    minMemoryMB?: number;
    deprecated?: boolean;
  }>;
  defaultVersion: string;
  defaultPort: number;
  configParameters: Array<{
    key: string;
    label: string;
    type: "integer" | "string" | "boolean";
    defaultValue: string;
    envMapping: string;
    description: string;
  }>;
}

export interface ServiceConnection {
  host: string | null;
  port: number | null;
  url: string | null;
  username: string | null;
  password: string | null;
  database: string | null;
  envVars?: Record<string, string>;
}

export const servicesApi = {
  getAll: async (params?: {
    projectId?: string;
    page?: number;
    limit?: number;
    type?: string;
    status?: string | string[];
    search?: string;
  }): Promise<PaginatedResponse<Service>> => {
    const filtered = Object.fromEntries(
      Object.entries(params ?? {}).filter(([, v]) => v !== undefined)
    );
    // Ensure status is always an array for Fastify's querystring parsing
    if (filtered.status && !Array.isArray(filtered.status)) {
      filtered.status = [filtered.status as string];
    }
    return apiClient.get("/api/services", { params: filtered });
  },

  getById: async (id: string): Promise<{ data: Service }> => {
    return apiClient.get(`/api/services/${id}`);
  },

  create: async (data: CreateServiceRequest): Promise<{ data: Service }> => {
    return apiClient.post("/api/services", data);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/api/services/${id}`);
  },

  getConnection: async (id: string, reveal = false): Promise<{ data: ServiceConnection }> => {
    return apiClient.get(`/api/services/${id}/connection`, {
      params: { reveal: reveal ? "true" : "false" },
    });
  },

  // Engine catalog
  getEngines: async (): Promise<{ data: EngineDetail[] }> => {
    return apiClient.get("/api/services/engines");
  },

  getEngineConfig: async (engine: string): Promise<{ data: EngineDetail }> => {
    return apiClient.get(`/api/services/engines/${engine}/config`);
  },

  // Lifecycle
  start: async (id: string): Promise<{ data: Service }> => {
    return apiClient.post(`/api/services/${id}/start`);
  },

  stop: async (id: string): Promise<{ data: Service }> => {
    return apiClient.post(`/api/services/${id}/stop`);
  },

  restart: async (id: string): Promise<{ data: Service }> => {
    return apiClient.post(`/api/services/${id}/restart`);
  },

  // Backups
  getBackups: async (id: string): Promise<{ data: ServiceBackup[] }> => {
    return apiClient.get(`/api/services/${id}/backups`);
  },

  triggerBackup: async (id: string): Promise<{ data: ServiceBackup }> => {
    return apiClient.post(`/api/services/${id}/backups`);
  },

  // Logs & Stats
  getLogs: async (id: string, tail?: number): Promise<{ data: { lines: string[] } }> => {
    const params: Record<string, string> = {};
    if (tail) {
      params.tail = tail.toString();
    }

    return apiClient.get(`/api/services/${id}/logs`, { params });
  },

  getStats: async (id: string): Promise<{ data: Record<string, unknown> }> => {
    return apiClient.get(`/api/services/${id}/stats`);
  },

  // Backup operations
  restoreBackup: async (serviceId: string, backupId: string): Promise<{ data: ServiceBackup }> => {
    return apiClient.post(`/api/services/${serviceId}/backups/${backupId}/restore`);
  },

  updateBackupSchedule: async (
    serviceId: string,
    data: { schedule?: "daily" | "weekly"; retention?: number }
  ): Promise<{ data: Service }> => {
    return apiClient.patch(`/api/services/${serviceId}/backup-schedule`, data);
  },

  // Shared services
  linkProject: async (
    serviceId: string,
    projectId: string
  ): Promise<{ data: { success: boolean } }> => {
    return apiClient.post(`/api/services/${serviceId}/link/${projectId}`);
  },

  unlinkProject: async (
    serviceId: string,
    projectId: string
  ): Promise<{ data: { success: boolean } }> => {
    return apiClient.delete(`/api/services/${serviceId}/link/${projectId}`);
  },

  // Upgrade
  upgrade: async (id: string, targetVersion: string): Promise<{ data: { jobId: string } }> => {
    return apiClient.post(`/api/services/${id}/upgrade`, { targetVersion });
  },

  // Orphan management
  getOrphans: async (): Promise<{
    data: {
      orphanedContainers: { name: string; serviceId: string }[];
      orphanedVolumes: { name: string; serviceId: string }[];
    };
  }> => {
    return apiClient.get("/api/services/orphans");
  },

  cleanupOrphans: async (): Promise<{
    data: { cleanedContainers: number; cleanedVolumes: number };
  }> => {
    return apiClient.post("/api/services/orphans/cleanup");
  },
};
