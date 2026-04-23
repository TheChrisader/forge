import { apiClient } from "../client";
import type {
  Alert,
  AlertRule,
  AlertChannel,
  CreateAlertRuleRequest,
  UpdateAlertRuleRequest,
  CreateAlertChannelRequest,
  UpdateAlertChannelRequest,
} from "@forge/types";

type Params = Record<string, string | number | boolean | string[]>;

function toParams(p?: Record<string, unknown>): Params | undefined {
  if (!p) return undefined;
  const result: Params = {};
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== null) {
      result[k] = v as string | number | boolean | string[];
    }
  }
  return result;
}

export interface AlertListParams {
  page?: number;
  limit?: number;
  projectId?: string;
  status?: string[];
  severity?: string[];
}

export interface AlertRuleListParams {
  page?: number;
  limit?: number;
  projectId?: string;
  enabled?: boolean;
  severity?: string[];
}

export interface AlertChannelListParams {
  page?: number;
  limit?: number;
  projectId?: string;
  type?: string[];
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export const alertsApi = {
  // Alerts
  getAlerts: async (params?: AlertListParams): Promise<PaginatedResponse<Alert>> => {
    return apiClient.get("/api/alerts", { params: toParams(params as Record<string, unknown>) });
  },

  getAlert: async (id: string): Promise<{ data: Alert }> => {
    return apiClient.get(`/api/alerts/${id}`);
  },

  acknowledgeAlert: async (id: string): Promise<{ data: Alert }> => {
    return apiClient.post(`/api/alerts/${id}/acknowledge`);
  },

  resolveAlert: async (id: string): Promise<{ data: Alert }> => {
    return apiClient.post(`/api/alerts/${id}/resolve`);
  },

  // Alert Rules
  getRules: async (params?: AlertRuleListParams): Promise<PaginatedResponse<AlertRule>> => {
    return apiClient.get("/api/alert-rules", {
      params: toParams(params as Record<string, unknown>),
    });
  },

  getRule: async (id: string): Promise<{ data: AlertRule }> => {
    return apiClient.get(`/api/alert-rules/${id}`);
  },

  createRule: async (data: CreateAlertRuleRequest): Promise<{ data: AlertRule }> => {
    return apiClient.post("/api/alert-rules", data);
  },

  updateRule: async (id: string, data: UpdateAlertRuleRequest): Promise<{ data: AlertRule }> => {
    return apiClient.patch(`/api/alert-rules/${id}`, data);
  },

  deleteRule: async (id: string): Promise<void> => {
    return apiClient.delete(`/api/alert-rules/${id}`);
  },

  // Alert Channels
  getChannels: async (
    params?: AlertChannelListParams
  ): Promise<PaginatedResponse<AlertChannel>> => {
    return apiClient.get("/api/alert-channels", {
      params: toParams(params as Record<string, unknown>),
    });
  },

  getChannel: async (id: string): Promise<{ data: AlertChannel }> => {
    return apiClient.get(`/api/alert-channels/${id}`);
  },

  createChannel: async (data: CreateAlertChannelRequest): Promise<{ data: AlertChannel }> => {
    return apiClient.post("/api/alert-channels", data);
  },

  updateChannel: async (
    id: string,
    data: UpdateAlertChannelRequest
  ): Promise<{ data: AlertChannel }> => {
    return apiClient.patch(`/api/alert-channels/${id}`, data);
  },

  deleteChannel: async (id: string): Promise<void> => {
    return apiClient.delete(`/api/alert-channels/${id}`);
  },

  addChannelRule: async (
    channelId: string,
    data: { ruleId: string; severities: string[] }
  ): Promise<{ data: { id: string } }> => {
    return apiClient.post(`/api/alert-channels/${channelId}/rules`, data);
  },

  removeChannelRule: async (channelId: string, ruleId: string): Promise<void> => {
    return apiClient.delete(`/api/alert-channels/${channelId}/rules/${ruleId}`);
  },
};
